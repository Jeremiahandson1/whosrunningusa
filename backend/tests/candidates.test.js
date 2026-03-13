const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const db = require('../db');

beforeEach(() => {
  jest.clearAllMocks();
});

// Helper: generate a valid JWT and mock the auth middleware DB lookup
function authHeaders(userId, userType = 'voter') {
  const token = jwt.sign({ userId, userType }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return { Authorization: `Bearer ${token}` };
}

function mockAuthUser(userId = 'user-1', userType = 'voter') {
  // Auth middleware does a DB lookup
  db.query.mockResolvedValueOnce({
    rows: [{ id: userId, email: 'test@test.com', username: 'testuser', user_type: userType, is_active: true, is_banned: false }]
  });
}

function mockCandidateAuth(userId = 'user-1') {
  mockAuthUser(userId, 'candidate');
}

describe('GET /api/candidates', () => {
  test('returns list of candidates', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'c1', display_name: 'Alice Smith', party_affiliation: 'D', follower_count: '5' },
        { id: 'c2', display_name: 'Bob Jones', party_affiliation: 'R', follower_count: '3' },
      ]
    });

    const res = await request(app).get('/api/candidates');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(2);
    expect(res.body.candidates[0].display_name).toBe('Alice Smith');
  });

  test('passes search filter to query', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/candidates?search=alice&limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(db.query).toHaveBeenCalledTimes(1);
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[1]).toContain('%alice%');
  });

  test('passes raceId filter to query', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/candidates?raceId=race-1');
    expect(res.status).toBe(200);
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[1]).toContain('race-1');
  });

  test('returns empty array when no candidates match', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/candidates');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([]);
  });
});

describe('GET /api/candidates/:id', () => {
  test('returns single candidate with positions and candidacies', async () => {
    // Main candidate query
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c1', display_name: 'Alice Smith', user_id: 'u1', follower_count: '10' }]
    });
    // Positions
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'pos1', issue_name: 'Healthcare', stance: 'support', category_name: 'Social' }]
    });
    // Candidacies
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cand1', race_name: 'Senate Race', office_name: 'U.S. Senate', election_date: '2026-11-03' }]
    });
    // Endorsements given
    db.query.mockResolvedValueOnce({ rows: [] });
    // Endorsements received
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/candidates/c1');
    expect(res.status).toBe(200);
    expect(res.body.candidate.display_name).toBe('Alice Smith');
    expect(res.body.candidate.positions).toHaveLength(1);
    expect(res.body.candidate.candidacies).toHaveLength(1);
    expect(res.body.candidate.isFollowing).toBe(false);
  });

  test('returns 404 for non-existent candidate', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/candidates/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Candidate not found');
  });

  test('includes isFollowing when authenticated user follows candidate', async () => {
    const headers = authHeaders('user-1', 'voter');
    // optionalAuth DB lookup
    mockAuthUser('user-1', 'voter');
    // Main candidate query
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c1', display_name: 'Alice Smith', user_id: 'u1', follower_count: '10' }]
    });
    // Positions
    db.query.mockResolvedValueOnce({ rows: [] });
    // Candidacies
    db.query.mockResolvedValueOnce({ rows: [] });
    // Endorsements given
    db.query.mockResolvedValueOnce({ rows: [] });
    // Endorsements received
    db.query.mockResolvedValueOnce({ rows: [] });
    // Follow check
    db.query.mockResolvedValueOnce({ rows: [{ id: 'follow-1' }] });

    const res = await request(app).get('/api/candidates/c1').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.candidate.isFollowing).toBe(true);
  });
});

describe('PUT /api/candidates/profile', () => {
  test('updates candidate profile successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    // Get profile ID
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Update query
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cp-1', display_name: 'New Name', party_affiliation: 'D' }]
    });

    const res = await request(app)
      .put('/api/candidates/profile')
      .set(headers)
      .send({ displayName: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.display_name).toBe('New Name');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .put('/api/candidates/profile')
      .send({ displayName: 'New Name' });

    expect(res.status).toBe(401);
  });

  test('rejects non-candidate user', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');

    const res = await request(app)
      .put('/api/candidates/profile')
      .set(headers)
      .send({ displayName: 'New Name' });

    expect(res.status).toBe(403);
  });

  test('returns 404 if candidate profile not found', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    // No profile found
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .put('/api/candidates/profile')
      .set(headers)
      .send({ displayName: 'New Name' });

    expect(res.status).toBe(404);
  });
});

describe('POST /api/candidates/promises', () => {
  test('creates a promise successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    // Get profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Insert promise
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'p1', candidate_id: 'cp-1', promise_text: 'I will fix roads', category_id: 'cat-1' }]
    });

    const res = await request(app)
      .post('/api/candidates/promises')
      .set(headers)
      .send({ promiseText: 'I will fix roads', categoryId: 'cat-1' });

    expect(res.status).toBe(200);
    expect(res.body.promise_text).toBe('I will fix roads');
  });

  test('rejects missing promiseText', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');

    const res = await request(app)
      .post('/api/candidates/promises')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('promiseText is required');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/candidates/promises')
      .send({ promiseText: 'I will fix roads' });

    expect(res.status).toBe(401);
  });
});

describe('POST /api/candidates/promises/:id/lock', () => {
  test('locks a promise successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    // Get profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Get promise
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1', is_locked: false }] });
    // Update promise
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'p1', is_locked: true, locked_at: new Date() }]
    });

    const res = await request(app)
      .post('/api/candidates/promises/p1/lock')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.is_locked).toBe(true);
  });

  test('returns 404 for non-existent promise', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/candidates/promises/nonexistent/lock')
      .set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Promise not found');
  });

  test('rejects locking another candidate\'s promise', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-OTHER', is_locked: false }] });

    const res = await request(app)
      .post('/api/candidates/promises/p1/lock')
      .set(headers);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not your promise');
  });

  test('rejects locking an already locked promise', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1', is_locked: true }] });

    const res = await request(app)
      .post('/api/candidates/promises/p1/lock')
      .set(headers);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Promise is already locked');
  });
});

describe('GET /api/candidates/:id/voting-record', () => {
  test('returns voting record with stats', async () => {
    // Votes query
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'vr1', vote: 'yes', bill_title: 'Infrastructure Bill', bill_number: 'HR-100' },
        { id: 'vr2', vote: 'no', bill_title: 'Tax Bill', bill_number: 'HR-200' },
      ]
    });
    // Stats query
    db.query.mockResolvedValueOnce({
      rows: [{ total_votes: '10', yes_votes: '6', no_votes: '3', missed_votes: '1' }]
    });

    const res = await request(app).get('/api/candidates/c1/voting-record');
    expect(res.status).toBe(200);
    expect(res.body.votes).toHaveLength(2);
    expect(res.body.stats.total_votes).toBe('10');
    expect(res.body.limit).toBe(50);
    expect(res.body.offset).toBe(0);
  });

  test('respects limit and offset parameters', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({
      rows: [{ total_votes: '0', yes_votes: '0', no_votes: '0', missed_votes: '0' }]
    });

    const res = await request(app).get('/api/candidates/c1/voting-record?limit=10&offset=5');
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(10);
    expect(res.body.offset).toBe(5);
  });

  test('returns empty votes when none exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({
      rows: [{ total_votes: '0', yes_votes: '0', no_votes: '0', missed_votes: '0' }]
    });

    const res = await request(app).get('/api/candidates/c1/voting-record');
    expect(res.status).toBe(200);
    expect(res.body.votes).toEqual([]);
  });
});
