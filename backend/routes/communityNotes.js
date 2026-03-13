const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, optionalAuth, requireVerifiedEmail } = require('../middleware/auth');

// Get notes for a piece of content
router.get('/:contentType/:contentId', optionalAuth, async (req, res, next) => {
  try {
    const { contentType, contentId } = req.params;
    const isAdmin = req.user && req.user.user_type === 'admin';

    let query = `
      SELECT cn.*, u.username as author_username
      FROM community_notes cn
      LEFT JOIN users u ON cn.author_id = u.id
      WHERE cn.content_type = $1 AND cn.content_id = $2
    `;
    if (!isAdmin) {
      query += ` AND cn.is_visible = TRUE`;
    }
    query += ` ORDER BY cn.helpful_count DESC, cn.created_at DESC`;

    const result = await db.query(query, [contentType, contentId]);

    // Include user's votes if authenticated
    if (req.user && result.rows.length > 0) {
      const noteIds = result.rows.map(n => n.id);
      const votesResult = await db.query(
        'SELECT note_id, vote FROM community_note_votes WHERE user_id = $1 AND note_id = ANY($2)',
        [req.user.id, noteIds]
      );
      const voteMap = {};
      votesResult.rows.forEach(v => { voteMap[v.note_id] = v.vote; });
      result.rows.forEach(n => {
        n.user_vote = voteMap[n.id] || null;
      });
    }

    res.json({ notes: result.rows });
  } catch (error) {
    next(error);
  }
});

// Submit a new note
router.post('/', authenticate, requireVerifiedEmail, async (req, res, next) => {
  try {
    const { contentType, contentId, noteText } = req.body;

    if (!contentType || !contentId || !noteText) {
      return res.status(400).json({ error: 'contentType, contentId, and noteText are required' });
    }

    if (noteText.length > 2000) {
      return res.status(400).json({ error: 'Note must be under 2000 characters' });
    }

    // Rate limit: max 5 notes per hour per user
    const recentNotes = await db.query(
      "SELECT COUNT(*) FROM community_notes WHERE author_id = $1 AND created_at > NOW() - INTERVAL '1 hour'",
      [req.user.id]
    );
    if (parseInt(recentNotes.rows[0].count) >= 5) {
      return res.status(429).json({ error: 'Too many notes. Please wait before adding more.' });
    }

    const result = await db.query(
      `INSERT INTO community_notes (content_type, content_id, note_text, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [contentType, contentId, noteText, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Vote on a note (toggle behavior)
router.post('/:noteId/vote', authenticate, async (req, res, next) => {
  try {
    const { noteId } = req.params;
    const { vote } = req.body;

    if (!vote || !['helpful', 'not_helpful'].includes(vote)) {
      return res.status(400).json({ error: 'vote must be "helpful" or "not_helpful"' });
    }

    // Check note exists
    const noteResult = await db.query('SELECT id FROM community_notes WHERE id = $1', [noteId]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Upsert vote using ON CONFLICT to prevent race conditions
    const existingVote = await db.query(
      'SELECT id, vote FROM community_note_votes WHERE note_id = $1 AND user_id = $2',
      [noteId, req.user.id]
    );

    if (existingVote.rows.length > 0) {
      if (existingVote.rows[0].vote === vote) {
        // Same vote — remove it (toggle off)
        await db.query('DELETE FROM community_note_votes WHERE id = $1', [existingVote.rows[0].id]);
      } else {
        // Different vote — update it
        await db.query('UPDATE community_note_votes SET vote = $1 WHERE id = $2', [vote, existingVote.rows[0].id]);
      }
    } else {
      // No existing vote — insert with conflict guard
      await db.query(
        'INSERT INTO community_note_votes (note_id, user_id, vote) VALUES ($1, $2, $3) ON CONFLICT (note_id, user_id) DO UPDATE SET vote = $3',
        [noteId, req.user.id, vote]
      );
    }

    // Recalculate counts
    const helpfulResult = await db.query(
      "SELECT COUNT(*) FROM community_note_votes WHERE note_id = $1 AND vote = 'helpful'",
      [noteId]
    );
    const notHelpfulResult = await db.query(
      "SELECT COUNT(*) FROM community_note_votes WHERE note_id = $1 AND vote = 'not_helpful'",
      [noteId]
    );

    const helpfulCount = parseInt(helpfulResult.rows[0].count);
    const notHelpfulCount = parseInt(notHelpfulResult.rows[0].count);

    // Auto-visibility: visible if helpful >= 3 AND helpful > not_helpful * 2
    const isVisible = helpfulCount >= 3 && helpfulCount > notHelpfulCount * 2;

    await db.query(
      'UPDATE community_notes SET helpful_count = $1, not_helpful_count = $2, is_visible = $3 WHERE id = $4',
      [helpfulCount, notHelpfulCount, isVisible, noteId]
    );

    // Get user's current vote state
    const currentVote = await db.query(
      'SELECT vote FROM community_note_votes WHERE note_id = $1 AND user_id = $2',
      [noteId, req.user.id]
    );

    res.json({
      helpful_count: helpfulCount,
      not_helpful_count: notHelpfulCount,
      is_visible: isVisible,
      user_vote: currentVote.rows[0]?.vote || null
    });
  } catch (error) {
    next(error);
  }
});

// Delete a note (author or admin)
router.delete('/:noteId', authenticate, async (req, res, next) => {
  try {
    const { noteId } = req.params;

    const noteResult = await db.query('SELECT id, author_id FROM community_notes WHERE id = $1', [noteId]);
    if (noteResult.rows.length === 0) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const note = noteResult.rows[0];
    const isAdmin = req.user.user_type === 'admin';
    const isAuthor = note.author_id === req.user.id;

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: 'Not authorized to delete this note' });
    }

    await db.query('DELETE FROM community_notes WHERE id = $1', [noteId]);

    res.json({ message: 'Note deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
