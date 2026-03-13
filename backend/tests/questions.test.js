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

function mockVerifiedEmail(userId = 'user-1') {
  db.query.mockResolvedValueOnce({ rows: [{ email_verified: true }] });
}

function mockUnverifiedEmail(userId = 'user-1') {
  db.query.mockResolvedValueOnce({ rows: [{ email_verified: false }] });
}

describe('GET /api/questions/candidate/:id', () => {
  test('returns questions for a candidate', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'q1', question_text: 'What is your stance on healthcare?', asked_by_username: 'voter1', upvote_count: '5' },
        { id: 'q2', question_text: 'How will you fix the economy?', asked_by_username: 'voter2', upvote_count: '3' },
      ]
    });

    const res = await request(app).get('/api/questions/candidate/c1');
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
  });

  test('returns empty list when no questions exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/questions/candidate/c1');
    expect(res.status).toBe(200);
    expect(res.body.questions).toEqual([]);
  });

  test('includes has_upvoted when authenticated', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Questions query
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'q1', question_text: 'Test?', upvote_count: '2' }]
    });
    // Upvotes check
    db.query.mockResolvedValueOnce({
      rows: [{ question_id: 'q1' }]
    });

    const res = await request(app)
      .get('/api/questions/candidate/c1')
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.questions[0].has_upvoted).toBe(true);
  });
});

describe('POST /api/questions', () => {
  test('creates a question successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockVerifiedEmail();
    // Candidate exists check
    db.query.mockResolvedValueOnce({ rows: [{ id: 'c1' }] });
    // Rate limit check
    db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    // Insert question
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'q1', candidate_id: 'c1', question_text: 'What is your plan?', asked_by_user_id: 'user-1' }]
    });
    // Update question count
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/questions')
      .set(headers)
      .send({ candidateId: 'c1', questionText: 'What is your plan?' });

    expect(res.status).toBe(201);
    expect(res.body.question_text).toBe('What is your plan?');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/questions')
      .send({ candidateId: 'c1', questionText: 'Test?' });

    expect(res.status).toBe(401);
  });

  test('rejects unverified email', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockUnverifiedEmail();

    const res = await request(app)
      .post('/api/questions')
      .set(headers)
      .send({ candidateId: 'c1', questionText: 'Test?' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Email verification required');
  });

  test('rejects missing required fields', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockVerifiedEmail();

    const res = await request(app)
      .post('/api/questions')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
  });

  test('rejects question over 1000 characters', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockVerifiedEmail();

    const res = await request(app)
      .post('/api/questions')
      .set(headers)
      .send({ candidateId: 'c1', questionText: 'x'.repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Question must be under 1000 characters');
  });

  test('returns 404 for non-existent candidate', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockVerifiedEmail();
    db.query.mockResolvedValueOnce({ rows: [] }); // candidate not found

    const res = await request(app)
      .post('/api/questions')
      .set(headers)
      .send({ candidateId: 'nonexistent', questionText: 'Test?' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Candidate not found');
  });
});

describe('POST /api/questions/:id/upvote', () => {
  test('upvotes a question successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Question exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'q1' }] });
    // Insert upvote
    db.query.mockResolvedValueOnce({ rows: [] });
    // Get count
    db.query.mockResolvedValueOnce({ rows: [{ count: '5' }] });

    const res = await request(app)
      .post('/api/questions/q1/upvote')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.upvoteCount).toBe(5);
  });

  test('returns 404 for non-existent question', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [] }); // question not found

    const res = await request(app)
      .post('/api/questions/nonexistent/upvote')
      .set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Question not found');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).post('/api/questions/q1/upvote');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/questions/:id/answer', () => {
  test('answers a question successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    // Get candidate profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Get question
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1' }] });
    // Insert answer
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'a1', question_id: 'q1', answer_text: 'My answer' }]
    });
    // Update question status
    db.query.mockResolvedValueOnce({ rows: [] });
    // Update candidate stats
    db.query.mockResolvedValueOnce({ rows: [] });
    // Get candidate name for notification
    db.query.mockResolvedValueOnce({ rows: [{ display_name: 'Alice Smith' }] });

    const res = await request(app)
      .post('/api/questions/q1/answer')
      .set(headers)
      .send({ answerText: 'My answer' });

    expect(res.status).toBe(200);
    expect(res.body.answer_text).toBe('My answer');
  });

  test('rejects missing answerText', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');

    const res = await request(app)
      .post('/api/questions/q1/answer')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('answerText is required');
  });

  test('rejects non-candidate user', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');

    const res = await request(app)
      .post('/api/questions/q1/answer')
      .set(headers)
      .send({ answerText: 'My answer' });

    expect(res.status).toBe(403);
  });

  test('rejects answering question not directed to this candidate', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-OTHER' }] });

    const res = await request(app)
      .post('/api/questions/q1/answer')
      .set(headers)
      .send({ answerText: 'My answer' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('This question is not for you');
  });

  test('returns 404 for non-existent question', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [] }); // question not found

    const res = await request(app)
      .post('/api/questions/nonexistent/answer')
      .set(headers)
      .send({ answerText: 'My answer' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Question not found');
  });
});
