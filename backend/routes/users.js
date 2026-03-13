const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, optionalAuth } = require('../middleware/auth');

// Update user profile
router.put('/profile', authenticate, async (req, res, next) => {
  try {
    const { firstName, lastName, bio, state, county, city, zipCode } = req.body;
    
    const result = await db.query(
      `UPDATE users 
       SET first_name = COALESCE($1, first_name),
           last_name = COALESCE($2, last_name),
           bio = COALESCE($3, bio),
           state = COALESCE($4, state),
           county = COALESCE($5, county),
           city = COALESCE($6, city),
           zip_code = COALESCE($7, zip_code),
           updated_at = NOW()
       WHERE id = $8
       RETURNING id, email, username, first_name, last_name, bio, state, county, city, zip_code`,
      [firstName, lastName, bio, state, county, city, zipCode, req.user.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get user's notification preferences
router.get('/notification-preferences', authenticate, async (req, res, next) => {
  try {
    let result = await db.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [req.user.id]
    );
    
    // Create default preferences if none exist
    if (result.rows.length === 0) {
      result = await db.query(
        `INSERT INTO notification_preferences (user_id) VALUES ($1) RETURNING *`,
        [req.user.id]
      );
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update notification preferences
router.put('/notification-preferences', authenticate, async (req, res, next) => {
  try {
    const {
      emailQuestionAnswered,
      emailNewCandidateArea,
      emailElectionReminder,
      emailFollowedPost,
      emailFollowedTownHall,
      emailRegistrationDeadline
    } = req.body;
    
    const result = await db.query(
      `INSERT INTO notification_preferences (user_id, email_question_answered, email_new_candidate_area, 
        email_election_reminder, email_followed_post, email_followed_town_hall, email_registration_deadline)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id) DO UPDATE SET
         email_question_answered = COALESCE($2, notification_preferences.email_question_answered),
         email_new_candidate_area = COALESCE($3, notification_preferences.email_new_candidate_area),
         email_election_reminder = COALESCE($4, notification_preferences.email_election_reminder),
         email_followed_post = COALESCE($5, notification_preferences.email_followed_post),
         email_followed_town_hall = COALESCE($6, notification_preferences.email_followed_town_hall),
         email_registration_deadline = COALESCE($7, notification_preferences.email_registration_deadline),
         updated_at = NOW()
       RETURNING *`,
      [req.user.id, emailQuestionAnswered, emailNewCandidateArea, emailElectionReminder,
       emailFollowedPost, emailFollowedTownHall, emailRegistrationDeadline]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Get user's notifications
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = req.query;
    
    let query = `
      SELECT * FROM notifications 
      WHERE user_id = $1
    `;
    const params = [req.user.id];
    
    if (unreadOnly === 'true') {
      query += ' AND is_read = FALSE';
    }
    
    query += ' ORDER BY created_at DESC LIMIT $2 OFFSET $3';
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    // Get unread count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    
    res.json({
      notifications: result.rows,
      unreadCount: parseInt(countResult.rows[0].count)
    });
  } catch (error) {
    next(error);
  }
});

// Mark notifications as read
router.post('/notifications/read', authenticate, async (req, res, next) => {
  try {
    const { notificationIds } = req.body;
    
    if (!notificationIds || !Array.isArray(notificationIds)) {
      return res.status(400).json({ error: 'notificationIds array required' });
    }
    
    await db.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW() 
       WHERE id = ANY($1) AND user_id = $2`,
      [notificationIds, req.user.id]
    );
    
    res.json({ message: 'Notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// Mark all notifications as read
router.post('/notifications/read-all', authenticate, async (req, res, next) => {
  try {
    await db.query(
      `UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});

// Get followed candidates
router.get('/following', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT cp.*, f.notify_posts, f.notify_qa, f.notify_town_halls, f.created_at as followed_at
       FROM follows f
       JOIN candidate_profiles cp ON f.candidate_id = cp.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Follow a candidate
router.post('/follow/:candidateId', authenticate, async (req, res, next) => {
  try {
    const { candidateId } = req.params;
    const { notifyPosts = true, notifyQa = true, notifyTownHalls = true } = req.body;
    
    await db.query(
      `INSERT INTO follows (user_id, candidate_id, notify_posts, notify_qa, notify_town_halls)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, candidate_id) DO UPDATE SET
         notify_posts = $3, notify_qa = $4, notify_town_halls = $5`,
      [req.user.id, candidateId, notifyPosts, notifyQa, notifyTownHalls]
    );
    
    res.json({ message: 'Now following candidate' });
  } catch (error) {
    next(error);
  }
});

// Unfollow a candidate
router.delete('/follow/:candidateId', authenticate, async (req, res, next) => {
  try {
    const { candidateId } = req.params;
    
    await db.query(
      'DELETE FROM follows WHERE user_id = $1 AND candidate_id = $2',
      [req.user.id, candidateId]
    );
    
    res.json({ message: 'Unfollowed candidate' });
  } catch (error) {
    next(error);
  }
});

// Get voting guide
router.get('/voting-guide/:electionId', authenticate, async (req, res, next) => {
  try {
    const { electionId } = req.params;
    
    // Get or create voting guide
    let guideResult = await db.query(
      'SELECT * FROM voting_guides WHERE user_id = $1 AND election_id = $2',
      [req.user.id, electionId]
    );
    
    if (guideResult.rows.length === 0) {
      guideResult = await db.query(
        `INSERT INTO voting_guides (user_id, election_id) VALUES ($1, $2) RETURNING *`,
        [req.user.id, electionId]
      );
    }
    
    const guide = guideResult.rows[0];
    
    // Get picks
    const picksResult = await db.query(
      `SELECT vgp.*, r.name as race_name, cp.display_name as candidate_name
       FROM voting_guide_picks vgp
       JOIN races r ON vgp.race_id = r.id
       LEFT JOIN candidate_profiles cp ON vgp.candidate_id = cp.id
       WHERE vgp.guide_id = $1`,
      [guide.id]
    );
    
    res.json({
      ...guide,
      picks: picksResult.rows
    });
  } catch (error) {
    next(error);
  }
});

// Update voting guide pick
router.post('/voting-guide/:electionId/pick', authenticate, async (req, res, next) => {
  try {
    const { electionId } = req.params;
    const { raceId, candidateId, isUndecided, notes } = req.body;
    
    if (!raceId) {
      return res.status(400).json({ error: 'raceId is required' });
    }
    
    // Get or create voting guide
    let guideResult = await db.query(
      'SELECT id FROM voting_guides WHERE user_id = $1 AND election_id = $2',
      [req.user.id, electionId]
    );
    
    if (guideResult.rows.length === 0) {
      guideResult = await db.query(
        `INSERT INTO voting_guides (user_id, election_id) VALUES ($1, $2) RETURNING id`,
        [req.user.id, electionId]
      );
    }
    
    const guideId = guideResult.rows[0].id;
    
    // Upsert pick
    const result = await db.query(
      `INSERT INTO voting_guide_picks (guide_id, race_id, candidate_id, is_undecided, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (guide_id, race_id) DO UPDATE SET
         candidate_id = $3, is_undecided = $4, notes = $5, updated_at = NOW()
       RETURNING *`,
      [guideId, raceId, isUndecided ? null : candidateId, isUndecided || false, notes]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
