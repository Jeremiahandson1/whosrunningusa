const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const db = require('../db');

beforeEach(() => {
  jest.clearAllMocks();
});

function authHeaders(userId, userType = 'voter') {
  const token = jwt.sign({ userId, userType }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

function mockAuthUser(userId = 'user-1', userType = 'voter') {
  db.query.mockResolvedValueOnce({
    rows: [{ id: userId, email: 'test@test.com', username: 'testuser', user_type: userType, is_active: true, is_banned: false }]
  });
}

describe('GET /api/town-halls/upcoming', () => {
  test('returns upcoming town halls', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'th1', title: 'Healthcare Forum', candidate_name: 'Alice Smith', candidate_id: 'c1', scheduled_at: '2026-04-15T18:00:00Z' },
        { id: 'th2', title: 'Education Talk', candidate_name: 'Bob Jones', candidate_id: 'c2', scheduled_at: '2026-04-20T19:00:00Z' },
      ]
    });

    const res = await request(app).get('/api/town-halls/upcoming');
    expect(res.status).toBe(200);
    expect(res.body.townHalls).toHaveLength(2);
    expect(res.body.townHalls[0].title).toBe('Healthcare Forum');
  });

  test('returns empty array when no upcoming town halls', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/town-halls/upcoming');
    expect(res.status).toBe(200);
    expect(res.body.townHalls).toEqual([]);
  });

  test('respects limit parameter', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/town-halls/upcoming?limit=5');
    expect(res.status).toBe(200);
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[1]).toContain(5);
  });
});

describe('POST /api/town-halls', () => {
  test('creates a town hall successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    // Get profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Insert town hall
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 'th1', candidate_id: 'cp-1', title: 'Healthcare Forum',
        format: 'video', scheduled_at: '2026-04-15T18:00:00Z', duration_minutes: 60
      }]
    });

    const res = await request(app)
      .post('/api/town-halls')
      .set(headers)
      .send({
        title: 'Healthcare Forum',
        format: 'video',
        scheduledAt: '2026-04-15T18:00:00Z',
        description: 'Discuss healthcare policy'
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Healthcare Forum');
  });

  test('rejects missing required fields', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');

    const res = await request(app)
      .post('/api/town-halls')
      .set(headers)
      .send({ title: 'Forum' }); // missing scheduledAt and format

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('title, scheduledAt, and format are required');
  });

  test('rejects invalid format', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');

    const res = await request(app)
      .post('/api/town-halls')
      .set(headers)
      .send({ title: 'Forum', scheduledAt: '2026-04-15T18:00:00Z', format: 'invalid_format' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid format');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/town-halls')
      .send({ title: 'Forum', scheduledAt: '2026-04-15T18:00:00Z', format: 'video' });

    expect(res.status).toBe(401);
  });

  test('rejects non-candidate user', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');

    const res = await request(app)
      .post('/api/town-halls')
      .set(headers)
      .send({ title: 'Forum', scheduledAt: '2026-04-15T18:00:00Z', format: 'video' });

    expect(res.status).toBe(403);
  });

  test('returns 404 when candidate profile not found', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [] }); // no profile

    const res = await request(app)
      .post('/api/town-halls')
      .set(headers)
      .send({ title: 'Forum', scheduledAt: '2026-04-15T18:00:00Z', format: 'video' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Candidate profile not found');
  });
});

describe('POST /api/town-halls/:id/rsvp', () => {
  test('RSVPs for a town hall successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Town hall exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'th1', candidate_id: 'cp-1' }] });
    // Insert RSVP
    db.query.mockResolvedValueOnce({ rows: [] });
    // Insert/update follow
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/town-halls/th1/rsvp')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('RSVP confirmed');
  });

  test('returns 404 for non-existent town hall', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [] }); // town hall not found

    const res = await request(app)
      .post('/api/town-halls/nonexistent/rsvp')
      .set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Town hall not found');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).post('/api/town-halls/th1/rsvp');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/town-halls/:id', () => {
  test('returns a single town hall with questions', async () => {
    // Town hall query
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'th1', title: 'Healthcare Forum', candidate_name: 'Alice Smith', scheduled_at: '2026-04-15T18:00:00Z' }]
    });
    // Questions query
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'q1', question_text: 'What about Medicare?', asked_by_username: 'voter1', upvote_count: 5 },
        { id: 'q2', question_text: 'Thoughts on ACA?', asked_by_username: 'voter2', upvote_count: 2 },
      ]
    });

    const res = await request(app).get('/api/town-halls/th1');
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Healthcare Forum');
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.questions[0].upvote_count).toBe(5);
  });

  test('returns 404 for non-existent town hall', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/town-halls/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Town hall not found');
  });
});

describe('POST /api/town-halls/:id/questions', () => {
  test('submits a question successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // requireVerifiedEmail check
    db.query.mockResolvedValueOnce({ rows: [{ email_verified: true }] });
    // Town hall exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'th1' }] });
    // Insert question
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'q1', town_hall_id: 'th1', question_text: 'What is your stance on taxes?', is_presubmitted: false }]
    });

    const res = await request(app)
      .post('/api/town-halls/th1/questions')
      .set(headers)
      .send({ questionText: 'What is your stance on taxes?' });

    expect(res.status).toBe(201);
    expect(res.body.question_text).toBe('What is your stance on taxes?');
  });

  test('rejects question without text', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [{ email_verified: true }] });

    const res = await request(app)
      .post('/api/town-halls/th1/questions')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('questionText is required');
  });

  test('returns 404 for non-existent town hall', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [{ email_verified: true }] });
    db.query.mockResolvedValueOnce({ rows: [] }); // town hall not found

    const res = await request(app)
      .post('/api/town-halls/nonexistent/questions')
      .set(headers)
      .send({ questionText: 'A question' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Town hall not found');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/town-halls/th1/questions')
      .send({ questionText: 'A question' });

    expect(res.status).toBe(401);
  });

  test('rejects user with unverified email', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [{ email_verified: false }] });

    const res = await request(app)
      .post('/api/town-halls/th1/questions')
      .set(headers)
      .send({ questionText: 'A question' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Email verification required');
  });
});

describe('POST /api/town-halls/:id/questions/:questionId/upvote', () => {
  test('upvotes a question successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Insert upvote (ON CONFLICT DO NOTHING RETURNING id — returns row on success)
    db.query.mockResolvedValueOnce({ rows: [{ id: 'upvote-1' }] });
    // Update count
    db.query.mockResolvedValueOnce({ rows: [] });
    // Get updated count
    db.query.mockResolvedValueOnce({ rows: [{ upvote_count: 6 }] });

    const res = await request(app)
      .post('/api/town-halls/th1/questions/q1/upvote')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.upvoteCount).toBe(6);
  });

  test('rejects duplicate upvote', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Insert upvote (ON CONFLICT DO NOTHING — returns empty rows on duplicate)
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/town-halls/th1/questions/q1/upvote')
      .set(headers);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Already upvoted');
  });

  test('rejects unauthenticated upvote', async () => {
    const res = await request(app).post('/api/town-halls/th1/questions/q1/upvote');
    expect(res.status).toBe(401);
  });
});
