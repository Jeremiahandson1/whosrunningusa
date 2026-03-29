const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const adminAuth = async (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey && process.env.ADMIN_API_KEY && process.env.ADMIN_API_KEY.length > 0) {
    const expected = Buffer.from(process.env.ADMIN_API_KEY);
    const provided = Buffer.from(String(adminKey));
    if (expected.length === provided.length && crypto.timingSafeEqual(expected, provided)) {
      return next();
    }
  }
  authenticate(req, res, (err) => {
    if (err) return res.status(401).json({ error: 'Authentication required' });
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.user_type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  });
};

// POST /candidate-claims — submit a claim to a candidate profile
router.post('/', authenticate, async (req, res, next) => {
  try {
    const { candidate_profile_id, claim_type, fec_candidate_id, official_name,
            office_sought, state, party, campaign_url } = req.body;

    if (claim_type === 'existing' && !candidate_profile_id) {
      return res.status(400).json({ error: 'candidate_profile_id is required for existing profile claims' });
    }
    if (claim_type === 'new' && !official_name) {
      return res.status(400).json({ error: 'official_name is required for new profile claims' });
    }

    // Check for existing pending claim
    const existing = await db.query(
      `SELECT id FROM candidate_claims WHERE user_id = $1 AND verification_status = 'pending'`,
      [req.user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'You already have a pending claim. Please wait for review.' });
    }

    // Check if profile already claimed by another user
    if (candidate_profile_id) {
      const claimed = await db.query(
        `SELECT cc.id FROM candidate_claims cc
         WHERE cc.candidate_profile_id = $1 AND cc.verification_status = 'approved'`,
        [candidate_profile_id]
      );
      if (claimed.rows.length > 0) {
        return res.status(409).json({ error: 'This candidate profile has already been claimed' });
      }
    }

    const result = await db.query(`
      INSERT INTO candidate_claims (user_id, candidate_profile_id, claim_type, fec_candidate_id,
        official_name, office_sought, state, party, campaign_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [req.user.id, candidate_profile_id || null, claim_type || 'existing',
        fec_candidate_id || null, official_name || null, office_sought || null,
        state || null, party || null, campaign_url || null]);

    res.status(201).json({ claim: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /candidate-claims/mine — get current user's claims
router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT cc.*, cp.display_name as profile_name
      FROM candidate_claims cc
      LEFT JOIN candidate_profiles cp ON cc.candidate_profile_id = cp.id
      WHERE cc.user_id = $1
      ORDER BY cc.submitted_at DESC
    `, [req.user.id]);

    res.json({ claims: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /candidate-claims/admin — list all claims for admin review
router.get('/admin', adminAuth, async (req, res, next) => {
  try {
    const { status = 'pending', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`cc.verification_status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(`SELECT COUNT(*) as total FROM candidate_claims cc ${where}`, params);
    const total = parseInt(countResult.rows[0].total);

    const result = await db.query(`
      SELECT cc.*, u.email, u.first_name, u.last_name,
             cp.display_name as profile_name, cp.fec_candidate_id as profile_fec_id
      FROM candidate_claims cc
      JOIN users u ON cc.user_id = u.id
      LEFT JOIN candidate_profiles cp ON cc.candidate_profile_id = cp.id
      ${where}
      ORDER BY cc.submitted_at ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...params, limit, offset]);

    res.json({ claims: result.rows, total, page: parseInt(page), totalPages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
});

// POST /candidate-claims/admin/:id/approve — approve a claim
router.post('/admin/:id/approve', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const claim = await db.query('SELECT * FROM candidate_claims WHERE id = $1', [id]);
    if (claim.rows.length === 0) return res.status(404).json({ error: 'Claim not found' });
    if (claim.rows[0].verification_status !== 'pending') {
      return res.status(400).json({ error: 'Claim is not pending' });
    }

    const c = claim.rows[0];
    await db.query('BEGIN');
    try {
      // Update claim
      await db.query(
        `UPDATE candidate_claims SET verification_status = 'approved', reviewed_at = NOW(), reviewed_by = $2 WHERE id = $1`,
        [id, req.user?.id || null]
      );

      // Upgrade user to candidate type
      await db.query(
        `UPDATE users SET user_type = 'candidate' WHERE id = $1 AND user_type = 'voter'`,
        [c.user_id]
      );

      let profileId = c.candidate_profile_id;

      // If new profile, create one
      if (c.claim_type === 'new' && !profileId) {
        const newProfile = await db.query(`
          INSERT INTO candidate_profiles (display_name, party_affiliation, fec_state, fec_candidate_id, candidate_verified)
          VALUES ($1, $2, $3, $4, true)
          RETURNING id
        `, [c.official_name, c.party, c.state, c.fec_candidate_id]);
        profileId = newProfile.rows[0].id;
        await db.query(
          `UPDATE candidate_claims SET candidate_profile_id = $2 WHERE id = $1`,
          [id, profileId]
        );
      }

      // Link user to profile
      if (profileId) {
        await db.query(
          `UPDATE users SET candidate_profile_id = $2 WHERE id = $1`,
          [c.user_id, profileId]
        );
        await db.query(
          `UPDATE candidate_profiles SET candidate_verified = true WHERE id = $1`,
          [profileId]
        );
      }

      await db.query('COMMIT');
      res.json({ approved: true, candidate_profile_id: profileId });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

// POST /candidate-claims/admin/:id/reject — reject a claim
router.post('/admin/:id/reject', adminAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rejection_reason } = req.body;

    const result = await db.query(
      `UPDATE candidate_claims
       SET verification_status = 'rejected', rejection_reason = $2, reviewed_at = NOW(), reviewed_by = $3
       WHERE id = $1 AND verification_status = 'pending'
       RETURNING *`,
      [id, rejection_reason || null, req.user?.id || null]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Claim not found or not pending' });
    res.json({ rejected: true, claim: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
