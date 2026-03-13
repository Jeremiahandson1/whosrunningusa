const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, optionalAuth, requireCandidate, requireVerifiedEmail } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Get upcoming town halls
router.get('/upcoming', async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    
    const result = await db.query(
      `SELECT th.*, cp.display_name as candidate_name, cp.id as candidate_id
       FROM town_halls th
       JOIN candidate_profiles cp ON th.candidate_id = cp.id
       WHERE th.scheduled_at > NOW() AND th.status = 'scheduled'
       ORDER BY th.scheduled_at ASC
       LIMIT $1`,
      [parseInt(limit)]
    );
    
    res.json({ townHalls: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get town halls for a candidate
router.get('/candidate/:candidateId', async (req, res, next) => {
  try {
    const { candidateId } = req.params;
    const { status, limit = 20, offset = 0 } = req.query;
    
    let query = `
      SELECT * FROM town_halls
      WHERE candidate_id = $1
    `;
    const params = [candidateId];
    let paramIndex = 2;
    
    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    query += ` ORDER BY scheduled_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    res.json({ townHalls: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get single town hall
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT th.*, cp.display_name as candidate_name
       FROM town_halls th
       JOIN candidate_profiles cp ON th.candidate_id = cp.id
       WHERE th.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Town hall not found' });
    }
    
    const townHall = result.rows[0];
    
    // Get questions
    const questionsResult = await db.query(
      `SELECT thq.*, u.username as asked_by_username
       FROM town_hall_questions thq
       LEFT JOIN users u ON thq.asked_by_user_id = u.id
       WHERE thq.town_hall_id = $1
       ORDER BY thq.upvote_count DESC, thq.created_at ASC`,
      [id]
    );
    
    res.json({
      ...townHall,
      questions: questionsResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Create a town hall
router.post('/', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { title, description, format, scheduledAt, durationMinutes = 60, restrictToDistrict = true } = req.body;
    
    if (!title || !scheduledAt || !format) {
      return res.status(400).json({ error: 'title, scheduledAt, and format are required' });
    }
    
    if (!['video', 'text_ama'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format' });
    }
    
    // Get candidate profile
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    const result = await db.query(
      `INSERT INTO town_halls (candidate_id, title, description, format, scheduled_at, duration_minutes, restrict_to_district)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [profileResult.rows[0].id, title, description, format, scheduledAt, durationMinutes, restrictToDistrict]
    );
    
    // Send notifications to followers
    notificationService.notifyFollowers(profileResult.rows[0].id, {
      type: 'new_town_hall',
      title: `Town Hall: ${title}`,
      message: description || `Scheduled for ${new Date(scheduledAt).toLocaleString()}`,
      referenceType: 'town_hall',
      referenceId: result.rows[0].id,
    }).catch(err => {
      console.error('Failed to send town hall notifications:', err.message);
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update town hall
router.put('/:id', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, scheduledAt, status, recordingUrl, transcript } = req.body;
    
    // Verify ownership
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    const townHallResult = await db.query(
      'SELECT candidate_id FROM town_halls WHERE id = $1',
      [id]
    );
    
    if (townHallResult.rows.length === 0) {
      return res.status(404).json({ error: 'Town hall not found' });
    }
    
    if (townHallResult.rows[0].candidate_id !== profileResult.rows[0].id) {
      return res.status(403).json({ error: 'Not your town hall' });
    }
    
    const result = await db.query(
      `UPDATE town_halls SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         scheduled_at = COALESCE($3, scheduled_at),
         status = COALESCE($4, status),
         recording_url = COALESCE($5, recording_url),
         transcript = COALESCE($6, transcript),
         updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, description, scheduledAt, status, recordingUrl, transcript, id]
    );
    
    // If completed, update candidate stats
    if (status === 'completed') {
      await db.query(
        'UPDATE candidate_profiles SET town_halls_held = town_halls_held + 1 WHERE id = $1',
        [profileResult.rows[0].id]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// RSVP for a town hall
router.post('/:id/rsvp', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify town hall exists
    const townHall = await db.query('SELECT id, candidate_id FROM town_halls WHERE id = $1', [id]);
    if (townHall.rows.length === 0) {
      return res.status(404).json({ error: 'Town hall not found' });
    }

    // Insert RSVP
    await db.query(
      `INSERT INTO town_hall_rsvps (town_hall_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (town_hall_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );

    // Also ensure user follows the candidate for notifications
    await db.query(
      `INSERT INTO follows (user_id, candidate_id, notify_town_halls)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (user_id, candidate_id) DO UPDATE SET notify_town_halls = TRUE`,
      [req.user.id, townHall.rows[0].candidate_id]
    );

    res.json({ message: 'RSVP confirmed' });
  } catch (error) {
    next(error);
  }
});

// Submit a question for town hall
router.post('/:id/questions', authenticate, requireVerifiedEmail, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionText, isPresubmitted = false } = req.body;
    
    if (!questionText) {
      return res.status(400).json({ error: 'questionText is required' });
    }
    
    // Verify town hall exists
    const townHallResult = await db.query(
      'SELECT id FROM town_halls WHERE id = $1',
      [id]
    );
    
    if (townHallResult.rows.length === 0) {
      return res.status(404).json({ error: 'Town hall not found' });
    }
    
    const result = await db.query(
      `INSERT INTO town_hall_questions (town_hall_id, asked_by_user_id, question_text, is_presubmitted)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, req.user.id, questionText, isPresubmitted]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Upvote town hall question (with duplicate prevention)
router.post('/:id/questions/:questionId/upvote', authenticate, async (req, res, next) => {
  try {
    const { questionId } = req.params;

    // Check if user already upvoted this question
    const existing = await db.query(
      `SELECT id FROM town_hall_question_upvotes WHERE question_id = $1 AND user_id = $2`,
      [questionId, req.user.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Already upvoted' });
    }

    // Record the upvote and increment count atomically
    await db.query(
      `INSERT INTO town_hall_question_upvotes (question_id, user_id) VALUES ($1, $2)`,
      [questionId, req.user.id]
    );

    await db.query(
      `UPDATE town_hall_questions SET upvote_count = upvote_count + 1 WHERE id = $1`,
      [questionId]
    );

    const result = await db.query(
      'SELECT upvote_count FROM town_hall_questions WHERE id = $1',
      [questionId]
    );

    res.json({ upvoteCount: result.rows[0]?.upvote_count || 0 });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
