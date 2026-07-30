const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /cost-calculator/items — list cost calculator items
router.get('/items', async (req, res, next) => {
  try {
    const { cost_type, fiscal_year, search, sort = 'title', page = 1 } = req.query;
    const limit = 20;
    const offset = (Math.max(1, parseInt(page)) - 1) * limit;

    const conditions = ['ci.is_active = true'];
    const params = [];
    let paramIndex = 1;

    if (cost_type) {
      conditions.push(`ci.cost_type = $${paramIndex}`);
      params.push(cost_type);
      paramIndex++;
    }
    if (fiscal_year) {
      conditions.push(`ci.fiscal_year = $${paramIndex}`);
      params.push(parseInt(fiscal_year));
      paramIndex++;
    }
    if (search) {
      conditions.push(`ci.title ILIKE $${paramIndex}`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    let orderBy = 'ci.title ASC';
    if (sort === 'cost') orderBy = 'ci.total_cost DESC';
    if (sort === 'year') orderBy = 'ci.fiscal_year DESC';

    const countResult = await db.query(
      `SELECT COUNT(*) as total FROM cost_calculator_items ci ${where}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const query = `
      SELECT ci.id, ci.title, ci.description, ci.cost_type, ci.total_cost,
             ci.fiscal_year, ci.duration_years, ci.source_url, ci.created_at
      FROM cost_calculator_items ci
      ${where}
      ORDER BY ${orderBy}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      items: result.rows,
      total,
      page: parseInt(page),
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    next(error);
  }
});

// GET /cost-calculator/brackets — income bracket options
router.get('/brackets', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, bracket_label, bracket_label AS label,
              min_income, max_income, tax_share_pct, household_count
       FROM income_brackets
       ORDER BY min_income`
    );

    res.json({ brackets: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /cost-calculator/calculate — compute personal cost
router.get('/calculate', async (req, res, next) => {
  try {
    const { item_id, bracket_id, family_size = 1 } = req.query;

    if (!item_id || !bracket_id) {
      return res.status(400).json({ error: 'item_id and bracket_id are required' });
    }

    const parsedFamilySize = Math.max(1, parseFloat(family_size));
    const avgFamilySize = 2.5;

    const itemResult = await db.query(
      `SELECT id, title, description, total_cost, duration_years, source_url, source_label
       FROM cost_calculator_items
       WHERE id = $1 AND is_active = true`,
      [item_id]
    );
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const item = itemResult.rows[0];

    const bracketResult = await db.query(
      `SELECT id, bracket_label, tax_share_pct, household_count
       FROM income_brackets
       WHERE id = $1`,
      [bracket_id]
    );
    if (bracketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Bracket not found' });
    }
    const bracket = bracketResult.rows[0];

    const baseShare = (parseFloat(item.total_cost) * parseFloat(bracket.tax_share_pct)) / parseInt(bracket.household_count);
    const yourTotalShare = baseShare * (parsedFamilySize / avgFamilySize);
    const yourAnnualShare = item.duration_years ? yourTotalShare / parseInt(item.duration_years) : null;

    // tax_share_pct is a FRACTION (0.019-0.239, summing to ~1 across
    // brackets) — multiply by 100 for display.
    const explanation = `Based on the ${bracket.bracket_label} bracket, your household's tax share is `
      + `${(parseFloat(bracket.tax_share_pct) * 100).toFixed(1)}% of the $${Number(item.total_cost).toLocaleString()} total cost, `
      + `split across ${Number(bracket.household_count).toLocaleString()} households in this bracket`
      + (parsedFamilySize !== avgFamilySize ? `, adjusted for a family size of ${parsedFamilySize} (avg ${avgFamilySize})` : '')
      + (yourAnnualShare ? `, spread over ${item.duration_years} years` : '')
      + '.';

    // Flat, snake_case: CostCalculatorPage reads result.household_cost,
    // result.item_title, result.duration_years etc. — the old nested
    // your_total_share shape rendered as "$0" for every calculation.
    res.json({
      household_cost: Math.round(yourTotalShare * 100) / 100,
      annual_cost: yourAnnualShare ? Math.round(yourAnnualShare * 100) / 100 : null,
      duration_years: item.duration_years ? parseInt(item.duration_years) : null,
      item_title: item.title,
      total_cost: item.total_cost,
      description: item.description,
      source_url: item.source_url,
      source_label: item.source_label,
      bracket_label: bracket.bracket_label,
      family_size: parsedFamilySize,
      calculation_explanation: explanation
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
