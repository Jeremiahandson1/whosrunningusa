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

describe('GET /api/races', () => {
  test('returns list of races', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'r1', name: 'Senate Race', office_name: 'U.S. Senate', office_level: 'federal', candidate_count: '3' },
        { id: 'r2', name: 'Governor Race', office_name: 'Governor', office_level: 'state', candidate_count: '2' },
      ]
    });

    const res = await request(app).get('/api/races');
    expect(res.status).toBe(200);
    expect(res.body.races).toHaveLength(2);
    expect(res.body.races[0].name).toBe('Senate Race');
  });

  test('filters by electionId', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/races?electionId=e1');
    expect(res.status).toBe(200);
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[1]).toContain('e1');
  });

  test('filters by state', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/races?state=CA');
    expect(res.status).toBe(200);
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[1]).toContain('CA');
  });

  test('returns empty when no races match', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/races');
    expect(res.status).toBe(200);
    expect(res.body.races).toEqual([]);
  });
});

describe('GET /api/races/:id', () => {
  test('returns race with candidates', async () => {
    // Race query
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', name: 'Senate Race', office_name: 'U.S. Senate', office_level: 'federal', election_date: '2026-11-03' }]
    });
    // Candidates query
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'c1', display_name: 'Alice Smith', filing_status: 'filed', first_name: 'Alice', last_name: 'Smith' },
        { id: 'c2', display_name: 'Bob Jones', filing_status: 'filed', first_name: 'Bob', last_name: 'Jones' },
      ]
    });

    const res = await request(app).get('/api/races/r1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Senate Race');
    expect(res.body.candidates).toHaveLength(2);
  });

  test('returns 404 for non-existent race', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/races/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Race not found');
  });
});

describe('GET /api/races/:id/compare', () => {
  test('compares candidates in a race', async () => {
    // Candidacies lookup (no candidateIds provided)
    db.query.mockResolvedValueOnce({
      rows: [{ candidate_id: 'c1' }, { candidate_id: 'c2' }]
    });
    // Race info
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', name: 'Senate Race', office_name: 'U.S. Senate', election_name: '2026 General' }]
    });
    // Candidate 1 info
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c1', display_name: 'Alice Smith', first_name: 'Alice', last_name: 'Smith' }]
    });
    // Candidate 1 positions
    db.query.mockResolvedValueOnce({
      rows: [{ issue_id: 'i1', issue_name: 'Healthcare', category_name: 'Social', stance: 'support' }]
    });
    // Candidate 2 info
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c2', display_name: 'Bob Jones', first_name: 'Bob', last_name: 'Jones' }]
    });
    // Candidate 2 positions
    db.query.mockResolvedValueOnce({
      rows: [{ issue_id: 'i1', issue_name: 'Healthcare', category_name: 'Social', stance: 'oppose' }]
    });

    const res = await request(app).get('/api/races/r1/compare');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(2);
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.race).toBeDefined();
  });

  test('returns 400 when fewer than 2 candidates', async () => {
    // Only 1 candidacy
    db.query.mockResolvedValueOnce({
      rows: [{ candidate_id: 'c1' }]
    });

    const res = await request(app).get('/api/races/r1/compare');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Need at least 2 candidates to compare');
  });

  test('compares specific candidates when candidateIds provided', async () => {
    // Race info
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', name: 'Senate Race', office_name: 'U.S. Senate', election_name: '2026 General' }]
    });
    // Candidate 1
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c1', display_name: 'Alice', first_name: 'Alice', last_name: 'Smith' }]
    });
    db.query.mockResolvedValueOnce({ rows: [] });
    // Candidate 2
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c2', display_name: 'Bob', first_name: 'Bob', last_name: 'Jones' }]
    });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/races/r1/compare?candidateIds=c1,c2');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(2);
  });
});

describe('POST /api/races/:id/file', () => {
  test('registers candidate for a race', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    // Get candidate profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Check race exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'r1' }] });
    // Insert candidacy
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'cand-1', candidate_id: 'cp-1', race_id: 'r1', filing_status: 'exploring' }]
    });

    const res = await request(app)
      .post('/api/races/r1/file')
      .set(headers)
      .send({ filingStatus: 'exploring' });

    expect(res.status).toBe(200);
    expect(res.body.filing_status).toBe('exploring');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/races/r1/file')
      .send({});

    expect(res.status).toBe(401);
  });

  test('rejects non-candidate user', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');

    const res = await request(app)
      .post('/api/races/r1/file')
      .set(headers)
      .send({});

    expect(res.status).toBe(403);
  });

  test('returns 404 when race does not exist', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [] }); // race not found

    const res = await request(app)
      .post('/api/races/nonexistent/file')
      .set(headers)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Race not found');
  });

  test('returns 404 when candidate profile not found', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [] }); // no profile

    const res = await request(app)
      .post('/api/races/r1/file')
      .set(headers)
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Candidate profile not found');
  });
});
