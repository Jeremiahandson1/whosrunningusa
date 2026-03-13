const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, optionalAuth, requireCandidate } = require('../middleware/auth');
const notificationService = require('../services/notificationService');

// Get posts for a candidate
router.get('/candidate/:candidateId', async (req, res, next) => {
  try {
    const { candidateId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await db.query(
      `SELECT * FROM posts
       WHERE candidate_id = $1 AND is_published = TRUE AND is_flagged = FALSE
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [candidateId, parseInt(limit), parseInt(offset)]
    );
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Get feed (posts from followed candidates)
router.get('/feed', authenticate, async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    
    const result = await db.query(
      `SELECT p.*, cp.display_name as candidate_name, cp.id as candidate_id
       FROM posts p
       JOIN candidate_profiles cp ON p.candidate_id = cp.id
       WHERE p.candidate_id IN (SELECT candidate_id FROM follows WHERE user_id = $1)
         AND p.is_published = TRUE AND p.is_flagged = FALSE
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Create a post
router.post('/', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { title, content, postType = 'update', mediaUrls } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'content is required' });
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
      `INSERT INTO posts (candidate_id, title, content, post_type, media_urls)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [profileResult.rows[0].id, title, content, postType, mediaUrls]
    );
    
    // Send notifications to followers
    notificationService.notifyFollowers(profileResult.rows[0].id, {
      type: 'new_post',
      title: title || 'New Update',
      message: content.slice(0, 200),
      referenceType: 'post',
      referenceId: result.rows[0].id,
    }).catch(err => {
      console.error('Failed to send post notifications:', err.message);
    });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update a post
router.put('/:id', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, postType } = req.body;
    
    // Verify ownership
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    const postResult = await db.query(
      'SELECT candidate_id FROM posts WHERE id = $1',
      [id]
    );
    
    if (postResult.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found' });
    }
    
    if (postResult.rows[0].candidate_id !== profileResult.rows[0].id) {
      return res.status(403).json({ error: 'Not your post' });
    }
    
    const result = await db.query(
      `UPDATE posts SET
         title = COALESCE($1, title),
         content = COALESCE($2, content),
         post_type = COALESCE($3, post_type),
         updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title, content, postType, id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a post
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
    
    const result = await db.query(
      'DELETE FROM posts WHERE id = $1 AND candidate_id = $2 RETURNING id',
      [id, profileResult.rows[0].id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Post not found or not yours' });
    }
    
    res.json({ message: 'Post deleted' });
  } catch (error) {
    next(error);
  }
});

// Flag a post
router.post('/:id/flag', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, details } = req.body;
    
    await db.query(
      `INSERT INTO moderation_flags (content_type, content_id, flagged_by_user_id, reason, details)
       VALUES ('post', $1, $2, $3, $4)`,
      [id, req.user.id, reason, details]
    );
    
    res.json({ message: 'Post flagged for review' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
