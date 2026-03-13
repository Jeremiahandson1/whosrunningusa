const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, requireCandidate } = require('../middleware/auth');

// GET /api/criminal-records/candidate/:candidateId - public records for a candidate
router.get('/candidate/:candidateId', async (req, res, next) => {
  try {
    const { candidateId } = req.params;

    const result = await db.query(
      `SELECT id, offense, year, jurisdiction, jurisdiction_level,
              disposition, sentence, source, candidate_statement, created_at
       FROM candidate_criminal_records
       WHERE candidate_id = $1 AND is_public = TRUE AND moderation_status = 'approved'
       ORDER BY year DESC NULLS LAST, created_at DESC`,
      [candidateId]
    );

    res.json({ records: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/criminal-records/my-records - candidate's own records (all statuses)
router.get('/my-records', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    const result = await db.query(
      `SELECT * FROM candidate_criminal_records
       WHERE candidate_id = $1
       ORDER BY year DESC NULLS LAST, created_at DESC`,
      [profileResult.rows[0].id]
    );

    res.json({ records: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/criminal-records - candidate self-reports a record
router.post('/', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { offense, year, jurisdiction, jurisdictionLevel, disposition, sentence, candidateStatement } = req.body;

    if (!offense || !disposition) {
      return res.status(400).json({ error: 'offense and disposition are required' });
    }

    const validDispositions = ['convicted', 'acquitted', 'expunged', 'dismissed', 'pending', 'no_contest', 'deferred', 'pardoned'];
    if (!validDispositions.includes(disposition)) {
      return res.status(400).json({ error: 'Invalid disposition' });
    }

    if (jurisdictionLevel && !['county', 'state', 'federal'].includes(jurisdictionLevel)) {
      return res.status(400).json({ error: 'Invalid jurisdiction level' });
    }

    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    // Self-reported records go public immediately (no moderation needed)
    const result = await db.query(
      `INSERT INTO candidate_criminal_records
        (candidate_id, offense, year, jurisdiction, jurisdiction_level, disposition, sentence, source, candidate_statement, is_public, moderation_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'self_reported', $8, TRUE, 'approved')
       RETURNING *`,
      [profileResult.rows[0].id, offense, year || null, jurisdiction || null, jurisdictionLevel || null, disposition, sentence || null, candidateStatement || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/criminal-records/:id - candidate updates their own self-reported record
router.put('/:id', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { offense, year, jurisdiction, jurisdictionLevel, disposition, sentence, candidateStatement } = req.body;

    if (disposition) {
      const validDispositions = ['convicted', 'acquitted', 'expunged', 'dismissed', 'pending', 'no_contest', 'deferred', 'pardoned'];
      if (!validDispositions.includes(disposition)) {
        return res.status(400).json({ error: 'Invalid disposition' });
      }
    }

    if (jurisdictionLevel && !['county', 'state', 'federal'].includes(jurisdictionLevel)) {
      return res.status(400).json({ error: 'Invalid jurisdiction level' });
    }

    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    // Verify ownership and that it's self-reported
    const record = await db.query(
      'SELECT candidate_id, source FROM candidate_criminal_records WHERE id = $1',
      [id]
    );
    if (record.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    if (record.rows[0].candidate_id !== profileResult.rows[0].id) {
      return res.status(403).json({ error: 'Not your record' });
    }
    if (record.rows[0].source !== 'self_reported') {
      return res.status(403).json({ error: 'Cannot edit system-pulled records' });
    }

    const result = await db.query(
      `UPDATE candidate_criminal_records SET
        offense = COALESCE($2, offense),
        year = COALESCE($3, year),
        jurisdiction = COALESCE($4, jurisdiction),
        jurisdiction_level = COALESCE($5, jurisdiction_level),
        disposition = COALESCE($6, disposition),
        sentence = COALESCE($7, sentence),
        candidate_statement = COALESCE($8, candidate_statement),
        updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, offense, year, jurisdiction, jurisdictionLevel, disposition, sentence, candidateStatement]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/criminal-records/:id - candidate deletes own self-reported record
router.delete('/:id', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    const record = await db.query(
      'SELECT candidate_id, source FROM candidate_criminal_records WHERE id = $1',
      [id]
    );
    if (record.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    if (record.rows[0].candidate_id !== profileResult.rows[0].id) {
      return res.status(403).json({ error: 'Not your record' });
    }
    if (record.rows[0].source !== 'self_reported') {
      return res.status(403).json({ error: 'Cannot delete system-pulled records' });
    }

    await db.query('DELETE FROM candidate_criminal_records WHERE id = $1', [id]);
    res.json({ message: 'Record deleted' });
  } catch (error) {
    next(error);
  }
});

// PUT /api/criminal-records/:id/statement - candidate adds statement to any record (including system-pulled)
router.put('/:id/statement', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { candidateStatement } = req.body;

    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    const record = await db.query(
      'SELECT candidate_id FROM candidate_criminal_records WHERE id = $1',
      [id]
    );
    if (record.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    if (record.rows[0].candidate_id !== profileResult.rows[0].id) {
      return res.status(403).json({ error: 'Not your record' });
    }

    const result = await db.query(
      `UPDATE candidate_criminal_records SET candidate_statement = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, candidateStatement]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
