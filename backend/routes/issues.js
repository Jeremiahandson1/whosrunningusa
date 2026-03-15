const express = require('express');
const router = express.Router();
const db = require('../db');

// Get all issues (flat list)
router.get('/', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT i.id, i.name, i.description, i.category_id, ic.name as category_name
       FROM issues i
       JOIN issue_categories ic ON i.category_id = ic.id
       WHERE i.is_active = TRUE
       ORDER BY ic.sort_order, i.sort_order`
    );
    res.json({ issues: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get all issue categories with their issues
router.get('/categories', async (req, res, next) => {
  try {
    const { officeLevel } = req.query;
    
    let query = 'SELECT * FROM issue_categories WHERE is_active = TRUE';
    const params = [];
    
    if (officeLevel) {
      if (officeLevel === 'federal') {
        query += ' AND applies_to_federal = TRUE';
      } else if (officeLevel === 'state') {
        query += ' AND applies_to_state = TRUE';
      } else if (['county', 'city', 'township', 'district'].includes(officeLevel)) {
        query += ' AND applies_to_local = TRUE';
      }
    }
    
    query += ' ORDER BY sort_order';
    
    const categoriesResult = await db.query(query, params);
    
    // Get issues for each category
    const categories = await Promise.all(categoriesResult.rows.map(async (category) => {
      const issuesResult = await db.query(
        'SELECT * FROM issues WHERE category_id = $1 AND is_active = TRUE ORDER BY sort_order',
        [category.id]
      );
      return {
        ...category,
        issues: issuesResult.rows
      };
    }));
    
    res.json(categories);
  } catch (error) {
    next(error);
  }
});

// Get single issue with candidate positions
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const issueResult = await db.query(
      `SELECT i.*, ic.name as category_name
       FROM issues i
       JOIN issue_categories ic ON i.category_id = ic.id
       WHERE i.id = $1`,
      [id]
    );
    
    if (issueResult.rows.length === 0) {
      return res.status(404).json({ error: 'Issue not found' });
    }
    
    const issue = issueResult.rows[0];
    
    // Get candidate positions on this issue (limit to prevent huge responses)
    const positionsResult = await db.query(
      `SELECT cp.*, cand.display_name as candidate_name, cand.id as candidate_id
       FROM candidate_positions cp
       JOIN candidate_profiles cand ON cp.candidate_id = cand.id
       WHERE cp.issue_id = $1
       ORDER BY cand.display_name
       LIMIT 100`,
      [id]
    );
    
    res.json({
      ...issue,
      positions: positionsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Find candidates by position on issue
router.get('/:id/candidates', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stance } = req.query;
    
    let query = `
      SELECT cand.*, cp.stance, cp.explanation
      FROM candidate_profiles cand
      JOIN candidate_positions cp ON cand.id = cp.candidate_id
      WHERE cp.issue_id = $1
    `;
    const params = [id];
    
    if (stance) {
      query += ' AND cp.stance = $2';
      params.push(stance);
    }
    
    query += ' ORDER BY cand.display_name LIMIT 100';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
