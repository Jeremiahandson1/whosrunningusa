const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, optionalAuth, requireCandidate, requireVerifiedEmail } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Get questions for a candidate
router.get('/candidate/:candidateId', optionalAuth, async (req, res, next) => {
  try {
    const { candidateId } = req.params;
    const { status = 'all', limit = 20, offset = 0, sort = 'upvotes' } = req.query;
    
    let query = `
      SELECT q.*, u.username as asked_by_username, u.profile_pic_url as asked_by_pic,
             a.id as answer_id, a.answer_text, a.created_at as answered_at,
             (SELECT COUNT(*) FROM question_upvotes WHERE question_id = q.id) as upvote_count
      FROM questions q
      LEFT JOIN users u ON q.asked_by_user_id = u.id
      LEFT JOIN answers a ON q.id = a.question_id
      WHERE q.candidate_id = $1
    `;
    const params = [candidateId];
    let paramIndex = 2;
    
    if (status !== 'all') {
      query += ` AND q.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    
    // Sort
    if (sort === 'upvotes') {
      query += ' ORDER BY q.upvote_count DESC, q.created_at DESC';
    } else if (sort === 'newest') {
      query += ' ORDER BY q.created_at DESC';
    } else if (sort === 'oldest') {
      query += ' ORDER BY q.created_at ASC';
    }
    
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    // Check if user has upvoted each question
    if (req.user) {
      const questionIds = result.rows.map(q => q.id);
      if (questionIds.length > 0) {
        const upvotesResult = await db.query(
          'SELECT question_id FROM question_upvotes WHERE user_id = $1 AND question_id = ANY($2)',
          [req.user.id, questionIds]
        );
        const upvotedIds = new Set(upvotesResult.rows.map(r => r.question_id));
        result.rows.forEach(q => {
          q.has_upvoted = upvotedIds.has(q.id);
        });
      }
    }
    
    res.json({ questions: result.rows });
  } catch (error) {
    next(error);
  }
});

// Ask a question
router.post('/', authenticate, requireVerifiedEmail, async (req, res, next) => {
  try {
    const { candidateId, candidate_id, questionText, question_text } = req.body;
    const resolvedCandidateId = candidateId || candidate_id;
    const resolvedQuestionText = questionText || question_text;
    
    if (!resolvedCandidateId || !resolvedQuestionText) {
      return res.status(400).json({ error: 'candidate_id and question_text are required' });
    }

    if (resolvedQuestionText.length > 1000) {
      return res.status(400).json({ error: 'Question must be under 1000 characters' });
    }

    // Verify candidate exists
    const candidateResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE id = $1',
      [resolvedCandidateId]
    );

    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }

    // Rate limit: max 10 questions per hour per user
    const recentQuestions = await db.query(
      "SELECT COUNT(*) FROM questions WHERE asked_by_user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
      [req.user.id]
    );
    if (parseInt(recentQuestions.rows[0].count) >= 10) {
      return res.status(429).json({ error: 'Too many questions. Please wait before asking more.' });
    }

    const result = await db.query(
      `INSERT INTO questions (candidate_id, asked_by_user_id, question_text)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [resolvedCandidateId, req.user.id, resolvedQuestionText]
    );

    // Update candidate's question count
    await db.query(
      'UPDATE candidate_profiles SET total_questions_received = total_questions_received + 1 WHERE id = $1',
      [resolvedCandidateId]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Upvote a question
router.post('/:id/upvote', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Check question exists
    const questionResult = await db.query('SELECT id FROM questions WHERE id = $1', [id]);
    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    
    await db.query(
      `INSERT INTO question_upvotes (question_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (question_id, user_id) DO NOTHING`,
      [id, req.user.id]
    );
    
    // Get updated count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM question_upvotes WHERE question_id = $1',
      [id]
    );
    
    res.json({ upvoteCount: parseInt(countResult.rows[0].count) });
  } catch (error) {
    next(error);
  }
});

// Remove upvote
router.delete('/:id/upvote', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    await db.query(
      'DELETE FROM question_upvotes WHERE question_id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    
    const countResult = await db.query(
      'SELECT COUNT(*) FROM question_upvotes WHERE question_id = $1',
      [id]
    );
    
    res.json({ upvoteCount: parseInt(countResult.rows[0].count) });
  } catch (error) {
    next(error);
  }
});

// Answer a question (candidate only)
router.post('/:id/answer', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answerText } = req.body;
    
    if (!answerText) {
      return res.status(400).json({ error: 'answerText is required' });
    }
    
    // Get candidate profile
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    const candidateId = profileResult.rows[0].id;
    
    // Verify question is for this candidate
    const questionResult = await db.query(
      'SELECT candidate_id, status FROM questions WHERE id = $1',
      [id]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (questionResult.rows[0].candidate_id !== candidateId) {
      return res.status(403).json({ error: 'This question is not for you' });
    }

    // Create or update answer
    const result = await db.query(
      `INSERT INTO answers (question_id, candidate_id, answer_text)
       VALUES ($1, $2, $3)
       ON CONFLICT (question_id) DO UPDATE SET answer_text = $3, updated_at = NOW()
       RETURNING *`,
      [id, candidateId, answerText]
    );
    
    // Update question status and only increment stats if this is a new answer (not a re-answer)
    const wasAnswered = questionResult.rows[0].status === 'answered';
    await db.query(
      `UPDATE questions SET status = 'answered', answered_at = NOW() WHERE id = $1`,
      [id]
    );

    if (!wasAnswered) {
      await db.query(
        `UPDATE candidate_profiles
         SET total_questions_answered = total_questions_answered + 1,
             qa_response_rate = (total_questions_answered + 1)::decimal / NULLIF(total_questions_received, 0) * 100
         WHERE id = $1`,
        [candidateId]
      );
    }
    
    // Send notification to question asker
    const candidateNameResult = await db.query('SELECT display_name FROM candidate_profiles WHERE id = $1', [candidateId]);
    const candidateName = candidateNameResult.rows[0]?.display_name || 'A candidate';
    notificationService.notifyQuestionAsker(id, candidateName).catch(err => {
      console.error('Failed to send answer notification:', err.message);
    });

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update an answer (candidate only)
router.put('/:id/answer', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answerText } = req.body;

    if (!answerText) {
      return res.status(400).json({ error: 'answerText is required' });
    }

    // Get candidate profile
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    const candidateId = profileResult.rows[0].id;

    // Verify question is for this candidate
    const questionResult = await db.query(
      'SELECT candidate_id FROM questions WHERE id = $1',
      [id]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (questionResult.rows[0].candidate_id !== candidateId) {
      return res.status(403).json({ error: 'This question is not for you' });
    }

    // Verify answer exists
    const answerResult = await db.query(
      'SELECT id FROM answers WHERE question_id = $1',
      [id]
    );

    if (answerResult.rows.length === 0) {
      return res.status(404).json({ error: 'No answer found for this question' });
    }

    // Update the answer text
    const result = await db.query(
      'UPDATE answers SET answer_text = $1, updated_at = NOW() WHERE question_id = $2 RETURNING *',
      [answerText, id]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete an answer (candidate only)
router.delete('/:id/answer', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Get candidate profile
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    const candidateId = profileResult.rows[0].id;

    // Verify question is for this candidate
    const questionResult = await db.query(
      'SELECT candidate_id, status FROM questions WHERE id = $1',
      [id]
    );

    if (questionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }

    if (questionResult.rows[0].candidate_id !== candidateId) {
      return res.status(403).json({ error: 'This question is not for you' });
    }

    // Verify answer exists
    const answerResult = await db.query(
      'SELECT id FROM answers WHERE question_id = $1',
      [id]
    );

    if (answerResult.rows.length === 0) {
      return res.status(404).json({ error: 'No answer found for this question' });
    }

    // Delete the answer
    await db.query('DELETE FROM answers WHERE question_id = $1', [id]);

    // Reset question status back to pending
    await db.query(
      "UPDATE questions SET status = 'pending', answered_at = NULL WHERE id = $1",
      [id]
    );

    // Decrement candidate stats
    await db.query(
      `UPDATE candidate_profiles
       SET total_questions_answered = GREATEST(total_questions_answered - 1, 0),
           qa_response_rate = GREATEST(total_questions_answered - 1, 0)::decimal / NULLIF(total_questions_received, 0) * 100
       WHERE id = $1`,
      [candidateId]
    );

    res.json({ message: 'Answer deleted' });
  } catch (error) {
    next(error);
  }
});

// Flag a question
router.post('/:id/flag', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, details } = req.body;
    
    await db.query(
      `INSERT INTO moderation_flags (content_type, content_id, flagged_by_user_id, reason, details)
       VALUES ('question', $1, $2, $3, $4)`,
      [id, req.user.id, reason, details]
    );
    
    res.json({ message: 'Question flagged for review' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
