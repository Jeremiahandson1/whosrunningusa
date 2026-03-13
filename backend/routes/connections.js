const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

// List my connections
router.get('/', authenticate, async (req, res, next) => {
  try {
    const { search, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT c.id as connection_id, c.created_at as connected_at,
             u.id, u.username, u.first_name, u.last_name, u.profile_pic_url,
             COALESCE(u.first_name || ' ' || u.last_name, u.username) as display_name
      FROM connections c
      JOIN users u ON (
        CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
      ) = u.id
      WHERE (c.user_a_id = $1 OR c.user_b_id = $1)
    `;
    const params = [req.user.id];
    let paramIndex = 2;

    if (search) {
      query += ` AND (u.username ILIKE $${paramIndex} OR u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    res.json({ connections: result.rows });
  } catch (error) {
    next(error);
  }
});

// List my pending incoming requests
router.get('/requests', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT cr.id, cr.created_at,
              u.id as user_id, u.username, u.first_name, u.last_name, u.profile_pic_url,
              COALESCE(u.first_name || ' ' || u.last_name, u.username) as display_name
       FROM connection_requests cr
       JOIN users u ON cr.requester_id = u.id
       WHERE cr.requested_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: result.rows });
  } catch (error) {
    next(error);
  }
});

// List my sent pending requests
router.get('/requests/sent', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT cr.id, cr.created_at,
              u.id as user_id, u.username, u.first_name, u.last_name, u.profile_pic_url,
              COALESCE(u.first_name || ' ' || u.last_name, u.username) as display_name
       FROM connection_requests cr
       JOIN users u ON cr.requested_id = u.id
       WHERE cr.requester_id = $1 AND cr.status = 'pending'
       ORDER BY cr.created_at DESC`,
      [req.user.id]
    );
    res.json({ requests: result.rows });
  } catch (error) {
    next(error);
  }
});

// Check connection status with a specific user
router.get('/status/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Check if connected
    const connectionResult = await db.query(
      `SELECT id FROM connections
       WHERE (user_a_id = $1 AND user_b_id = $2)
          OR (user_a_id = $2 AND user_b_id = $1)`,
      [req.user.id, userId]
    );
    if (connectionResult.rows.length > 0) {
      return res.json({ status: 'connected' });
    }

    // Check for pending request sent by me
    const sentResult = await db.query(
      `SELECT id FROM connection_requests
       WHERE requester_id = $1 AND requested_id = $2 AND status = 'pending'`,
      [req.user.id, userId]
    );
    if (sentResult.rows.length > 0) {
      return res.json({ status: 'pending_sent', requestId: sentResult.rows[0].id });
    }

    // Check for pending request received from them
    const receivedResult = await db.query(
      `SELECT id FROM connection_requests
       WHERE requester_id = $1 AND requested_id = $2 AND status = 'pending'`,
      [userId, req.user.id]
    );
    if (receivedResult.rows.length > 0) {
      return res.json({ status: 'pending_received', requestId: receivedResult.rows[0].id });
    }

    res.json({ status: 'none' });
  } catch (error) {
    next(error);
  }
});

// Send connection request
router.post('/request/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Prevent self-request
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot send a connection request to yourself' });
    }

    // Check if user exists
    const userResult = await db.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if already connected
    const connectionResult = await db.query(
      `SELECT id FROM connections
       WHERE (user_a_id = $1 AND user_b_id = $2)
          OR (user_a_id = $2 AND user_b_id = $1)`,
      [req.user.id, userId]
    );
    if (connectionResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already connected' });
    }

    // Check for existing pending request (either direction)
    const existingResult = await db.query(
      `SELECT id FROM connection_requests
       WHERE ((requester_id = $1 AND requested_id = $2) OR (requester_id = $2 AND requested_id = $1))
         AND status = 'pending'`,
      [req.user.id, userId]
    );
    if (existingResult.rows.length > 0) {
      return res.status(400).json({ error: 'A pending request already exists' });
    }

    const result = await db.query(
      `INSERT INTO connection_requests (requester_id, requested_id)
       VALUES ($1, $2)
       RETURNING *`,
      [req.user.id, userId]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Accept connection request
router.put('/request/:requestId/accept', authenticate, async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const { requestId } = req.params;

    // Get the request
    const requestResult = await client.query(
      `SELECT * FROM connection_requests WHERE id = $1 AND status = 'pending'`,
      [requestId]
    );
    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Must be the requested user
    if (request.requested_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized to accept this request' });
    }

    // Store smaller UUID as user_a_id for consistency
    const userA = request.requester_id < request.requested_id ? request.requester_id : request.requested_id;
    const userB = request.requester_id < request.requested_id ? request.requested_id : request.requester_id;

    // Update request status
    await client.query(
      `UPDATE connection_requests SET status = 'accepted', responded_at = NOW() WHERE id = $1`,
      [requestId]
    );

    // Create connection
    const connectionResult = await client.query(
      `INSERT INTO connections (user_a_id, user_b_id)
       VALUES ($1, $2)
       ON CONFLICT (user_a_id, user_b_id) DO NOTHING
       RETURNING *`,
      [userA, userB]
    );

    await client.query('COMMIT');
    res.json({ message: 'Connection accepted', connection: connectionResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Reject connection request
router.put('/request/:requestId/reject', authenticate, async (req, res, next) => {
  try {
    const { requestId } = req.params;

    // Get the request
    const requestResult = await db.query(
      `SELECT * FROM connection_requests WHERE id = $1 AND status = 'pending'`,
      [requestId]
    );
    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const request = requestResult.rows[0];

    // Must be the requested user
    if (request.requested_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to reject this request' });
    }

    await db.query(
      `UPDATE connection_requests SET status = 'rejected', responded_at = NOW() WHERE id = $1`,
      [requestId]
    );

    res.json({ message: 'Connection request rejected' });
  } catch (error) {
    next(error);
  }
});

// Remove connection
router.delete('/:userId', authenticate, async (req, res, next) => {
  try {
    const { userId } = req.params;

    const result = await db.query(
      `DELETE FROM connections
       WHERE (user_a_id = $1 AND user_b_id = $2)
          OR (user_a_id = $2 AND user_b_id = $1)
       RETURNING id`,
      [req.user.id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    res.json({ message: 'Connection removed' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
