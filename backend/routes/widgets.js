const express = require('express');
const router = express.Router();
const db = require('../db');
const crypto = require('crypto');
const { authenticate, requireAdmin } = require('../middleware/auth');

const WIDGET_TYPES = [
  'debt-clock',
  'political-roi',
  'voting-record',
  'campaign-finance',
  'transparency-score',
  'trade-monitor',
  'promise-tracker'
];

const EVENT_TYPES = ['embed', 'interaction', 'click', 'error'];

const WIDGET_CATALOG = [
  {
    type: 'debt-clock',
    name: 'National Debt Clock',
    description: 'Live animated counters showing national debt, deficit, per-citizen debt, and interest payments.',
    data_attributes: ['theme', 'show-deficit', 'show-per-citizen', 'show-interest'],
    embed_template: '<div data-wru-widget="debt-clock" data-theme="light"></div><script src="https://whosrunningusa.com/widgets/embed.js" async></script>'
  },
  {
    type: 'political-roi',
    name: 'Political ROI Calculator',
    description: 'Shows the return on investment for political spending — what donors paid vs. what they received in contracts and policy value.',
    data_attributes: ['entity', 'entity-type', 'theme'],
    embed_template: '<div data-wru-widget="political-roi" data-entity="entity-slug" data-theme="light"></div><script src="https://whosrunningusa.com/widgets/embed.js" async></script>'
  },
  {
    type: 'voting-record',
    name: 'Voting Record Card',
    description: 'Compact card displaying a candidate\'s voting record, key votes, and party-line percentage.',
    data_attributes: ['candidate-id', 'theme', 'show-key-votes'],
    embed_template: '<div data-wru-widget="voting-record" data-candidate-id="CANDIDATE_ID" data-theme="light"></div><script src="https://whosrunningusa.com/widgets/embed.js" async></script>'
  },
  {
    type: 'campaign-finance',
    name: 'Campaign Finance Tracker',
    description: 'Donor breakdown, top contributors, and funding sources for a candidate or race.',
    data_attributes: ['candidate-id', 'race-id', 'theme'],
    embed_template: '<div data-wru-widget="campaign-finance" data-candidate-id="CANDIDATE_ID" data-theme="light"></div><script src="https://whosrunningusa.com/widgets/embed.js" async></script>'
  },
  {
    type: 'transparency-score',
    name: 'Transparency Scorecard',
    description: 'Compliance scores for body cameras, FOIA responses, and financial disclosures.',
    data_attributes: ['entity-id', 'entity-type', 'theme', 'show-breakdown'],
    embed_template: '<div data-wru-widget="transparency-score" data-entity-id="ENTITY_ID" data-theme="light"></div><script src="https://whosrunningusa.com/widgets/embed.js" async></script>'
  },
  {
    type: 'trade-monitor',
    name: 'Stock Trade Monitor',
    description: 'Recent stock trades by officials with flag indicators for potential conflicts of interest.',
    data_attributes: ['official-id', 'theme', 'days', 'flagged-only'],
    embed_template: '<div data-wru-widget="trade-monitor" data-theme="light" data-days="90"></div><script src="https://whosrunningusa.com/widgets/embed.js" async></script>'
  },
  {
    type: 'promise-tracker',
    name: 'Promise Tracker',
    description: 'Tracks campaign promises with status indicators: kept, broken, in-progress, or stalled.',
    data_attributes: ['candidate-id', 'theme', 'show-details'],
    embed_template: '<div data-wru-widget="promise-tracker" data-candidate-id="CANDIDATE_ID" data-theme="light"></div><script src="https://whosrunningusa.com/widgets/embed.js" async></script>'
  }
];

// GET /catalog — public list of all available widgets
router.get('/catalog', async (req, res, next) => {
  try {
    res.json({ widgets: WIDGET_CATALOG });
  } catch (err) {
    next(err);
  }
});

// GET /roi — query political ROI entities
router.get('/roi', async (req, res, next) => {
  try {
    const { entity, entity_type, sort = 'roi_ratio', limit = 10, page = 1 } = req.query;
    const parsedLimit = Math.min(Math.max(1, parseInt(limit)), 100);
    const parsedPage = Math.max(1, parseInt(page));
    const offset = (parsedPage - 1) * parsedLimit;

    // Single entity lookup by slug
    if (entity) {
      const conditions = ['slug = $1'];
      const params = [entity];
      if (entity_type) {
        conditions.push('entity_type = $2');
        params.push(entity_type);
      }
      const result = await db.query(
        `SELECT * FROM political_roi_entities WHERE ${conditions.join(' AND ')} LIMIT 1`,
        params
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entity not found' });
      }
      return res.json({ entity: result.rows[0] });
    }

    // Paginated list
    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (entity_type) {
      conditions.push(`entity_type = $${paramIndex}`);
      params.push(entity_type);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sortColumns = {
      roi_ratio: 'roi_ratio DESC NULLS LAST',
      spend: 'total_spend DESC NULLS LAST',
      return: 'total_return DESC NULLS LAST'
    };
    const orderBy = sortColumns[sort] || sortColumns.roi_ratio;

    const countResult = await db.query(
      `SELECT COUNT(*) FROM political_roi_entities ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const dataParams = [...params, parsedLimit, offset];
    const result = await db.query(
      `SELECT * FROM political_roi_entities ${where}
       ORDER BY ${orderBy}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      dataParams
    );

    res.json({
      entities: result.rows,
      total,
      page: parsedPage,
      totalPages: Math.ceil(total / parsedLimit)
    });
  } catch (err) {
    next(err);
  }
});

// POST /event — track widget analytics (no auth required)
router.post('/event', async (req, res, next) => {
  try {
    const { widget_type, host_domain, event_type, event_data, api_key } = req.body;

    if (!widget_type || !WIDGET_TYPES.includes(widget_type)) {
      return res.status(400).json({ error: `Invalid widget_type. Must be one of: ${WIDGET_TYPES.join(', ')}` });
    }
    if (!event_type || !EVENT_TYPES.includes(event_type)) {
      return res.status(400).json({ error: `Invalid event_type. Must be one of: ${EVENT_TYPES.join(', ')}` });
    }

    let apiKeyId = null;

    if (api_key) {
      const keyHash = crypto.createHash('sha256').update(api_key).digest('hex');
      const keyResult = await db.query(
        `SELECT id FROM widget_api_keys WHERE key_hash = $1 AND is_active = true`,
        [keyHash]
      );
      if (keyResult.rows.length > 0) {
        apiKeyId = keyResult.rows[0].id;
        await db.query(
          `UPDATE widget_api_keys SET usage_count = usage_count + 1, last_used_at = NOW() WHERE id = $1`,
          [apiKeyId]
        );
      }
    }

    await db.query(
      `INSERT INTO widget_analytics (widget_type, host_domain, event_type, event_data, api_key_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [widget_type, host_domain || null, event_type, event_data ? JSON.stringify(event_data) : null, apiKeyId]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// GET /analytics — admin only, widget embed statistics
router.get('/analytics', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { widget_type, days = 30 } = req.query;
    const parsedDays = Math.max(1, parseInt(days));

    const conditions = [`created_at >= NOW() - INTERVAL '${parsedDays} days'`];
    const params = [];
    let paramIndex = 1;

    if (widget_type) {
      conditions.push(`widget_type = $${paramIndex}`);
      params.push(widget_type);
      paramIndex++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const totalResult = await db.query(
      `SELECT COUNT(*) AS total FROM widget_analytics ${where}`,
      params
    );
    const totalEmbeds = parseInt(totalResult.rows[0].total);

    const uniqueDomainsResult = await db.query(
      `SELECT COUNT(DISTINCT host_domain) AS count FROM widget_analytics ${where} AND host_domain IS NOT NULL`,
      params
    );
    const uniqueDomains = parseInt(uniqueDomainsResult.rows[0].count);

    const byTypeResult = await db.query(
      `SELECT widget_type, COUNT(*) AS count FROM widget_analytics ${where}
       GROUP BY widget_type ORDER BY count DESC`,
      params
    );
    const byWidgetType = {};
    for (const row of byTypeResult.rows) {
      byWidgetType[row.widget_type] = parseInt(row.count);
    }

    const topDomainsResult = await db.query(
      `SELECT host_domain, COUNT(*) AS count FROM widget_analytics ${where} AND host_domain IS NOT NULL
       GROUP BY host_domain ORDER BY count DESC LIMIT 10`,
      params
    );
    const topDomains = topDomainsResult.rows.map(r => ({
      domain: r.host_domain,
      count: parseInt(r.count)
    }));

    res.json({ totalEmbeds, uniqueDomains, byWidgetType, topDomains });
  } catch (err) {
    next(err);
  }
});

// POST /api-keys — admin only, create a new widget API key
router.post('/api-keys', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { organization_name, is_white_label = false, domain_allowlist } = req.body;

    if (!organization_name) {
      return res.status(400).json({ error: 'organization_name is required' });
    }

    const plainKey = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(plainKey).digest('hex');
    const keyPrefix = plainKey.substring(0, 8);

    const result = await db.query(
      `INSERT INTO widget_api_keys (key_hash, key_prefix, organization_name, is_white_label, domain_allowlist)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, key_prefix, organization_name`,
      [keyHash, keyPrefix, organization_name, is_white_label, domain_allowlist ? JSON.stringify(domain_allowlist) : null]
    );

    res.status(201).json({
      key: plainKey,
      key_prefix: result.rows[0].key_prefix,
      organization_name: result.rows[0].organization_name
    });
  } catch (err) {
    next(err);
  }
});

// GET /api-keys — admin only, list all API keys
router.get('/api-keys', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, key_prefix, organization_name, is_white_label, is_active, usage_count, last_used_at, created_at
       FROM widget_api_keys
       ORDER BY created_at DESC`
    );
    res.json({ keys: result.rows });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
