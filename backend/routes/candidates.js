const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticate, optionalAuth, requireCandidate } = require('../middleware/auth');

// Get all candidates with filters
router.get('/', optionalAuth, async (req, res, next) => {
  try {
    const { 
      state, county, city, 
      officeLevel, 
      electionId, raceId,
      search,
      limit = 20, offset = 0 
    } = req.query;
    
    let query = `
      SELECT cp.*, u.username, u.first_name, u.last_name,
             COUNT(DISTINCT f.id) as follower_count
      FROM candidate_profiles cp
      LEFT JOIN users u ON cp.user_id = u.id
      LEFT JOIN follows f ON cp.id = f.candidate_id
      WHERE cp.is_active = TRUE
    `;
    const params = [];
    let paramIndex = 1;
    
    // Filter by candidacy/race
    if (raceId) {
      query += ` AND cp.id IN (SELECT candidate_id FROM candidacies WHERE race_id = $${paramIndex})`;
      params.push(raceId);
      paramIndex++;
    } else if (electionId) {
      query += ` AND cp.id IN (
        SELECT candidate_id FROM candidacies c 
        JOIN races r ON c.race_id = r.id 
        WHERE r.election_id = $${paramIndex}
      )`;
      params.push(electionId);
      paramIndex++;
    }
    
    // Search
    if (search) {
      query += ` AND (
        cp.display_name ILIKE $${paramIndex} OR 
        u.first_name ILIKE $${paramIndex} OR 
        u.last_name ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ` GROUP BY cp.id, u.id ORDER BY cp.display_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);

    res.json({ candidates: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get single candidate
router.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT cp.*, u.username, u.first_name, u.last_name, u.email_verified,
              COUNT(DISTINCT f.id) as follower_count
       FROM candidate_profiles cp
       LEFT JOIN users u ON cp.user_id = u.id
       LEFT JOIN follows f ON cp.id = f.candidate_id
       WHERE cp.id = $1
       GROUP BY cp.id, u.id`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    const candidate = result.rows[0];
    
    // Get positions
    const positionsResult = await db.query(
      `SELECT cp.*, i.name as issue_name, ic.name as category_name
       FROM candidate_positions cp
       JOIN issues i ON cp.issue_id = i.id
       JOIN issue_categories ic ON i.category_id = ic.id
       WHERE cp.candidate_id = $1
       ORDER BY cp.priority_rank NULLS LAST, ic.sort_order, i.sort_order`,
      [id]
    );
    
    // Get candidacies (races they're running in)
    const candidaciesResult = await db.query(
      `SELECT c.*, r.name as race_name, o.name as office_name, e.election_date, e.name as election_name
       FROM candidacies c
       JOIN races r ON c.race_id = r.id
       JOIN offices o ON r.office_id = o.id
       JOIN elections e ON r.election_id = e.id
       WHERE c.candidate_id = $1
       ORDER BY e.election_date DESC`,
      [id]
    );
    
    // Get endorsements given
    const endorsementsGivenResult = await db.query(
      `SELECT e.*, cp.display_name as endorsed_name
       FROM endorsements e
       JOIN candidate_profiles cp ON e.endorsed_id = cp.id
       WHERE e.endorser_id = $1`,
      [id]
    );
    
    // Get endorsements received
    const endorsementsReceivedResult = await db.query(
      `SELECT e.*, cp.display_name as endorser_name
       FROM endorsements e
       JOIN candidate_profiles cp ON e.endorser_id = cp.id
       WHERE e.endorsed_id = $1`,
      [id]
    );
    
    // Check if current user follows
    let isFollowing = false;
    if (req.user) {
      const followResult = await db.query(
        'SELECT id FROM follows WHERE user_id = $1 AND candidate_id = $2',
        [req.user.id, id]
      );
      isFollowing = followResult.rows.length > 0;
    }
    
    res.json({
      candidate: {
        ...candidate,
        positions: positionsResult.rows,
        candidacies: candidaciesResult.rows,
        endorsements: endorsementsReceivedResult.rows.map(e => ({
          ...e,
          display_name: e.endorser_name,
          name: e.endorser_name,
        })),
        endorsementsGiven: endorsementsGivenResult.rows,
        isFollowing
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update candidate profile (own profile only)
router.put('/profile', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const {
      displayName, officialTitle, partyAffiliation,
      campaignWebsite, campaignEmail, campaignPhone,
      fullBio, education, professionalBackground,
      twitterHandle, facebookHandle
    } = req.body;
    
    // Get candidate profile ID for this user
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    const result = await db.query(
      `UPDATE candidate_profiles SET
         display_name = COALESCE($1, display_name),
         official_title = COALESCE($2, official_title),
         party_affiliation = COALESCE($3, party_affiliation),
         campaign_website = COALESCE($4, campaign_website),
         campaign_email = COALESCE($5, campaign_email),
         campaign_phone = COALESCE($6, campaign_phone),
         full_bio = COALESCE($7, full_bio),
         education = COALESCE($8, education),
         professional_background = COALESCE($9, professional_background),
         twitter_handle = COALESCE($10, twitter_handle),
         facebook_handle = COALESCE($11, facebook_handle),
         updated_at = NOW()
       WHERE user_id = $12
       RETURNING *`,
      [displayName, officialTitle, partyAffiliation, campaignWebsite, campaignEmail,
       campaignPhone, fullBio, education, professionalBackground, twitterHandle,
       facebookHandle, req.user.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Start identity verification (Stripe Identity)
router.post('/verify/start', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const stripeService = require('../services/stripeService');

    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    const returnUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/candidate/edit?verified=true`;
    const session = await stripeService.createVerificationSession(
      profileResult.rows[0].id,
      returnUrl
    );

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    if (error.message === 'Stripe is not configured') {
      return res.status(503).json({ error: 'Identity verification is not available' });
    }
    next(error);
  }
});

// Check verification status
router.get('/verify/status', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const profileResult = await db.query(
      'SELECT id, identity_verified FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    res.json({
      identityVerified: profileResult.rows[0].identity_verified,
    });
  } catch (error) {
    next(error);
  }
});

// Stripe webhook for verification completion
router.post('/verify/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    return res.status(503).json({ error: 'Webhooks not configured' });
  }

  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);

    if (event.type === 'identity.verification_session.verified') {
      const session = event.data.object;
      const candidateId = session.metadata?.candidateId;

      if (candidateId) {
        await db.query(
          `UPDATE candidate_profiles SET
            identity_verified = TRUE,
            identity_verified_at = NOW()
           WHERE id = $1`,
          [candidateId]
        );
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: 'Webhook error' });
  }
});

// Set position on an issue
router.post('/positions', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { issueId, stance, explanation, priorityRank } = req.body;
    
    if (!issueId || !stance) {
      return res.status(400).json({ error: 'issueId and stance are required' });
    }
    
    if (!['support', 'oppose', 'complicated'].includes(stance)) {
      return res.status(400).json({ error: 'Invalid stance' });
    }
    
    // Get candidate profile ID
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    const candidateId = profileResult.rows[0].id;
    
    const result = await db.query(
      `INSERT INTO candidate_positions (candidate_id, issue_id, stance, explanation, priority_rank)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (candidate_id, issue_id) DO UPDATE SET
         stance = $3, explanation = $4, priority_rank = $5, updated_at = NOW()
       RETURNING *`,
      [candidateId, issueId, stance, explanation, priorityRank]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Endorse another candidate
router.post('/endorse/:endorsedId', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { endorsedId } = req.params;
    const { endorsementText } = req.body;
    
    // Get candidate profile IDs
    const endorserResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (endorserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Your candidate profile not found' });
    }
    
    const endorserId = endorserResult.rows[0].id;
    
    if (endorserId === endorsedId) {
      return res.status(400).json({ error: 'Cannot endorse yourself' });
    }
    
    // Verify endorsed candidate exists
    const endorsedResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE id = $1',
      [endorsedId]
    );
    
    if (endorsedResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate to endorse not found' });
    }
    
    const result = await db.query(
      `INSERT INTO endorsements (endorser_id, endorsed_id, endorsement_text)
       VALUES ($1, $2, $3)
       ON CONFLICT (endorser_id, endorsed_id) DO UPDATE SET endorsement_text = $3
       RETURNING *`,
      [endorserId, endorsedId, endorsementText]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Remove endorsement
router.delete('/endorse/:endorsedId', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { endorsedId } = req.params;
    
    const endorserResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (endorserResult.rows.length === 0) {
      return res.status(404).json({ error: 'Your candidate profile not found' });
    }
    
    await db.query(
      'DELETE FROM endorsements WHERE endorser_id = $1 AND endorsed_id = $2',
      [endorserResult.rows[0].id, endorsedId]
    );
    
    res.json({ message: 'Endorsement removed' });
  } catch (error) {
    next(error);
  }
});

// Get candidate's promises
router.get('/:id/promises', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT p.*, ic.name as category_name
       FROM promises p
       LEFT JOIN issue_categories ic ON p.category_id = ic.id
       WHERE p.candidate_id = $1
       ORDER BY p.created_at DESC`,
      [id]
    );
    
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// Add a promise (candidate only, for own profile)
router.post('/promises', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { promiseText, categoryId } = req.body;
    
    if (!promiseText) {
      return res.status(400).json({ error: 'promiseText is required' });
    }
    
    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }
    
    const result = await db.query(
      `INSERT INTO promises (candidate_id, promise_text, category_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [profileResult.rows[0].id, promiseText, categoryId]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Update a promise status (candidate only, for own profile)
router.put('/promises/:promiseId', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { promiseId } = req.params;
    const { status, statusExplanation } = req.body;

    if (status && !['pending', 'kept', 'broken', 'in_progress', 'compromised'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    // Verify ownership
    const promise = await db.query(
      'SELECT candidate_id, is_locked FROM promises WHERE id = $1',
      [promiseId]
    );
    if (promise.rows.length === 0) {
      return res.status(404).json({ error: 'Promise not found' });
    }
    if (promise.rows[0].candidate_id !== profileResult.rows[0].id) {
      return res.status(403).json({ error: 'Not your promise' });
    }
    if (promise.rows[0].is_locked) {
      return res.status(403).json({ error: 'Cannot update a locked promise' });
    }

    const result = await db.query(
      `UPDATE promises SET
        status = COALESCE($2, status),
        status_explanation = COALESCE($3, status_explanation),
        status_updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
      [promiseId, status, statusExplanation]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Lock a promise (candidate only, own profile)
router.post('/promises/:promiseId/lock', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { promiseId } = req.params;

    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    const promise = await db.query(
      'SELECT candidate_id, is_locked FROM promises WHERE id = $1',
      [promiseId]
    );
    if (promise.rows.length === 0) {
      return res.status(404).json({ error: 'Promise not found' });
    }
    if (promise.rows[0].candidate_id !== profileResult.rows[0].id) {
      return res.status(403).json({ error: 'Not your promise' });
    }
    if (promise.rows[0].is_locked) {
      return res.status(400).json({ error: 'Promise is already locked' });
    }

    const result = await db.query(
      `UPDATE promises SET is_locked = TRUE, locked_at = NOW() WHERE id = $1 RETURNING *`,
      [promiseId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a promise (candidate only, own profile, only if not locked)
router.delete('/promises/:promiseId', authenticate, requireCandidate, async (req, res, next) => {
  try {
    const { promiseId } = req.params;

    const profileResult = await db.query(
      'SELECT id FROM candidate_profiles WHERE user_id = $1',
      [req.user.id]
    );
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate profile not found' });
    }

    const promise = await db.query(
      'SELECT candidate_id, is_locked FROM promises WHERE id = $1',
      [promiseId]
    );
    if (promise.rows.length === 0) {
      return res.status(404).json({ error: 'Promise not found' });
    }
    if (promise.rows[0].candidate_id !== profileResult.rows[0].id) {
      return res.status(403).json({ error: 'Not your promise' });
    }
    if (promise.rows[0].is_locked) {
      return res.status(403).json({ error: 'Cannot delete a locked promise' });
    }

    await db.query('DELETE FROM promises WHERE id = $1', [promiseId]);
    res.json({ message: 'Promise deleted' });
  } catch (error) {
    next(error);
  }
});

// Get candidate's voting record
router.get('/:id/voting-record', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;
    
    const result = await db.query(
      `SELECT 
        vr.*,
        b.title as bill_title,
        b.bill_number,
        b.status as bill_status,
        b.state as bill_state,
        b.chamber as bill_chamber,
        p.promise_text as related_promise
       FROM voting_records vr
       LEFT JOIN bills b ON vr.bill_id IS NOT NULL AND vr.bill_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND vr.bill_id::uuid = b.id
       LEFT JOIN promises p ON vr.related_promise_id = p.id
       WHERE vr.candidate_id = $1
       ORDER BY vr.vote_date DESC NULLS LAST
       LIMIT $2 OFFSET $3`,
      [id, parseInt(limit), parseInt(offset)]
    );
    
    // Get summary stats
    const statsResult = await db.query(
      `SELECT 
        COUNT(*) as total_votes,
        COUNT(*) FILTER (WHERE vote = 'yes') as yes_votes,
        COUNT(*) FILTER (WHERE vote = 'no') as no_votes,
        COUNT(*) FILTER (WHERE vote IN ('not voting', 'absent')) as missed_votes
       FROM voting_records
       WHERE candidate_id = $1`,
      [id]
    );
    
    res.json({
      votes: result.rows,
      stats: statsResult.rows[0],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

// Get candidate's bill sponsorships
router.get('/:id/sponsorships', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        bs.*,
        b.title,
        b.bill_number,
        b.status,
        b.state,
        b.chamber,
        b.introduced_date,
        b.last_action_date
       FROM bill_sponsorships bs
       JOIN bills b ON bs.bill_id = b.id
       WHERE bs.candidate_id = $1
    `;
    const params = [id];
    let paramIndex = 2;
    
    if (type) {
      query += ` AND bs.sponsorship_type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    
    query += ` ORDER BY b.introduced_date DESC NULLS LAST
               LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    // Get counts by type
    const countsResult = await db.query(
      `SELECT 
        sponsorship_type,
        COUNT(*) as count
       FROM bill_sponsorships
       WHERE candidate_id = $1
       GROUP BY sponsorship_type`,
      [id]
    );
    
    res.json({
      sponsorships: result.rows,
      counts: countsResult.rows,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    next(error);
  }
});

// Get candidate's full transparency profile
router.get('/:id/transparency', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Basic info
    const candidateResult = await db.query(
      `SELECT 
        cp.id, cp.display_name, cp.party_affiliation, cp.official_title,
        cp.open_states_id, cp.fec_candidate_id
       FROM candidate_profiles cp
       WHERE cp.id = $1`,
      [id]
    );
    
    if (candidateResult.rows.length === 0) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    const candidate = candidateResult.rows[0];
    
    // Voting stats
    const votingStats = await db.query(
      `SELECT 
        COUNT(*) as total_votes,
        COUNT(*) FILTER (WHERE vote = 'yes') as yes_votes,
        COUNT(*) FILTER (WHERE vote = 'no') as no_votes,
        COUNT(*) FILTER (WHERE vote IN ('not voting', 'absent')) as missed_votes
       FROM voting_records
       WHERE candidate_id = $1`,
      [id]
    );
    
    // Sponsorship stats
    const sponsorshipStats = await db.query(
      `SELECT 
        COUNT(*) as total_sponsorships,
        COUNT(*) FILTER (WHERE sponsorship_type = 'primary') as primary_sponsor,
        COUNT(*) FILTER (WHERE sponsorship_type = 'cosponsor') as cosponsor
       FROM bill_sponsorships
       WHERE candidate_id = $1`,
      [id]
    );
    
    // Recent votes
    const recentVotes = await db.query(
      `SELECT 
        vr.vote, vr.vote_date, vr.bill_name,
        b.bill_number, b.title, b.status
       FROM voting_records vr
       LEFT JOIN bills b ON vr.bill_id IS NOT NULL AND vr.bill_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND vr.bill_id::uuid = b.id
       WHERE vr.candidate_id = $1
       ORDER BY vr.vote_date DESC NULLS LAST
       LIMIT 10`,
      [id]
    );
    
    // Recent sponsorships
    const recentSponsorships = await db.query(
      `SELECT 
        bs.sponsorship_type,
        b.id as bill_id, b.bill_number, b.title, b.status, b.introduced_date
       FROM bill_sponsorships bs
       JOIN bills b ON bs.bill_id = b.id
       WHERE bs.candidate_id = $1
       ORDER BY b.introduced_date DESC NULLS LAST
       LIMIT 10`,
      [id]
    );
    
    // Calculate transparency score (simplified)
    const totalVotes = parseInt(votingStats.rows[0].total_votes) || 0;
    const missedVotes = parseInt(votingStats.rows[0].missed_votes) || 0;
    const attendanceRate = totalVotes > 0 
      ? Math.round(((totalVotes - missedVotes) / totalVotes) * 100) 
      : null;
    
    res.json({
      candidate,
      voting: {
        stats: votingStats.rows[0],
        attendanceRate,
        recent: recentVotes.rows
      },
      sponsorships: {
        stats: sponsorshipStats.rows[0],
        recent: recentSponsorships.rows
      },
      transparencyScore: {
        overall: attendanceRate, // Simplified for now
        components: {
          votingAttendance: attendanceRate,
          // Will add more components as we get more data
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;