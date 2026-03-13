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

describe('POST /api/users/follow/:candidateId', () => {
  test('follows a candidate successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Insert follow
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/users/follow/c1')
      .set(headers)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Now following candidate');
  });

  test('follows with notification preferences', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/users/follow/c1')
      .set(headers)
      .send({ notifyPosts: false, notifyQa: true, notifyTownHalls: true });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Now following candidate');
    // Verify the query was called with correct params
    const callArgs = db.query.mock.calls[1]; // second call (first is auth)
    expect(callArgs[1]).toContain(false); // notifyPosts
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).post('/api/users/follow/c1').send({});
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/users/follow/:candidateId', () => {
  test('unfollows a candidate successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Delete follow
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/users/follow/c1')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Unfollowed candidate');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).delete('/api/users/follow/c1');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/users/voting-guide/:electionId', () => {
  test('returns existing voting guide with picks', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Get guide
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'guide-1', user_id: 'user-1', election_id: 'e1' }]
    });
    // Get picks
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'pick-1', race_name: 'Senate Race', candidate_name: 'Alice Smith' },
        { id: 'pick-2', race_name: 'Governor', candidate_name: 'Bob Jones' },
      ]
    });

    const res = await request(app)
      .get('/api/users/voting-guide/e1')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('guide-1');
    expect(res.body.picks).toHaveLength(2);
  });

  test('creates new voting guide if none exists', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // No existing guide
    db.query.mockResolvedValueOnce({ rows: [] });
    // Create guide
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'guide-new', user_id: 'user-1', election_id: 'e1' }]
    });
    // Get picks (empty for new guide)
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .get('/api/users/voting-guide/e1')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('guide-new');
    expect(res.body.picks).toEqual([]);
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/users/voting-guide/e1');
    expect(res.status).toBe(401);
  });
});
