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

function mockCandidateAuth(userId = 'user-1') {
  mockAuthUser(userId, 'candidate');
}

function mockAdminAuth(userId = 'admin-1') {
  mockAuthUser(userId, 'admin');
}

describe('GET /api/criminal-records/candidate/:candidateId', () => {
  test('returns only public approved records', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'r1', offense: 'DUI', year: 2019, disposition: 'convicted', source: 'self_reported' },
      ]
    });

    const res = await request(app).get('/api/criminal-records/candidate/c1');
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
    expect(res.body.records[0].offense).toBe('DUI');
  });

  test('returns empty array when no records', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/criminal-records/candidate/c1');
    expect(res.status).toBe(200);
    expect(res.body.records).toEqual([]);
  });
});

describe('GET /api/criminal-records/my-records', () => {
  test('returns all records for authenticated candidate', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    // Get profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Get records
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'r1', offense: 'DUI', moderation_status: 'approved' },
        { id: 'r2', offense: 'Theft', moderation_status: 'pending' },
      ]
    });

    const res = await request(app).get('/api/criminal-records/my-records').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(2);
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/criminal-records/my-records');
    expect(res.status).toBe(401);
  });

  test('rejects non-candidate user', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');

    const res = await request(app).get('/api/criminal-records/my-records').set(headers);
    expect(res.status).toBe(403);
  });
});

describe('POST /api/criminal-records', () => {
  test('creates self-reported record successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    // Get profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Insert record
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', offense: 'DUI', disposition: 'convicted', source: 'self_reported', is_public: true, moderation_status: 'approved' }]
    });

    const res = await request(app)
      .post('/api/criminal-records')
      .set(headers)
      .send({ offense: 'DUI', disposition: 'convicted', year: 2019 });

    expect(res.status).toBe(201);
    expect(res.body.source).toBe('self_reported');
    expect(res.body.is_public).toBe(true);
  });

  test('rejects missing offense', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');

    const res = await request(app)
      .post('/api/criminal-records')
      .set(headers)
      .send({ disposition: 'convicted' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('offense and disposition are required');
  });

  test('rejects missing disposition', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');

    const res = await request(app)
      .post('/api/criminal-records')
      .set(headers)
      .send({ offense: 'DUI' });

    expect(res.status).toBe(400);
  });

  test('rejects invalid disposition', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');

    const res = await request(app)
      .post('/api/criminal-records')
      .set(headers)
      .send({ offense: 'DUI', disposition: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid disposition');
  });

  test('rejects invalid jurisdiction level', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');

    const res = await request(app)
      .post('/api/criminal-records')
      .set(headers)
      .send({ offense: 'DUI', disposition: 'convicted', jurisdictionLevel: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid jurisdiction level');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/criminal-records')
      .send({ offense: 'DUI', disposition: 'convicted' });

    expect(res.status).toBe(401);
  });
});

describe('PUT /api/criminal-records/:id', () => {
  test('updates own self-reported record', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    // Get profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Get record (ownership check)
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1', source: 'self_reported' }] });
    // Update
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', offense: 'Updated DUI', disposition: 'convicted' }]
    });

    const res = await request(app)
      .put('/api/criminal-records/r1')
      .set(headers)
      .send({ offense: 'Updated DUI' });

    expect(res.status).toBe(200);
    expect(res.body.offense).toBe('Updated DUI');
  });

  test('rejects editing system-pulled record', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1', source: 'system_pulled' }] });

    const res = await request(app)
      .put('/api/criminal-records/r1')
      .set(headers)
      .send({ offense: 'Updated' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Cannot edit system-pulled records');
  });

  test('rejects editing another candidates record', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-OTHER', source: 'self_reported' }] });

    const res = await request(app)
      .put('/api/criminal-records/r1')
      .set(headers)
      .send({ offense: 'Updated' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not your record');
  });
});

describe('DELETE /api/criminal-records/:id', () => {
  test('deletes own self-reported record', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1', source: 'self_reported' }] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/criminal-records/r1')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Record deleted');
  });

  test('rejects deleting system-pulled record', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1', source: 'system_pulled' }] });

    const res = await request(app)
      .delete('/api/criminal-records/r1')
      .set(headers);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Cannot delete system-pulled records');
  });

  test('returns 404 for nonexistent record', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/criminal-records/nonexistent')
      .set(headers);

    expect(res.status).toBe(404);
  });
});

describe('PUT /api/criminal-records/:id/statement', () => {
  test('adds statement to any record', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', candidate_statement: 'My statement' }]
    });

    const res = await request(app)
      .put('/api/criminal-records/r1/statement')
      .set(headers)
      .send({ candidateStatement: 'My statement' });

    expect(res.status).toBe(200);
    expect(res.body.candidate_statement).toBe('My statement');
  });

  test('rejects statement on another candidates record', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockCandidateAuth('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-OTHER' }] });

    const res = await request(app)
      .put('/api/criminal-records/r1/statement')
      .set(headers)
      .send({ candidateStatement: 'My statement' });

    expect(res.status).toBe(403);
  });
});

describe('Admin criminal records endpoints', () => {
  test('GET /api/admin/criminal-records/queue returns pending records', async () => {
    const headers = authHeaders('admin-1', 'admin');
    mockAdminAuth('admin-1');

    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', offense: 'DUI', candidate_name: 'Alice', moderation_status: 'pending' }]
    });

    const res = await request(app)
      .get('/api/admin/criminal-records/queue')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.records).toHaveLength(1);
  });

  test('PUT /api/admin/criminal-records/:id/moderate approves a record', async () => {
    const headers = authHeaders('admin-1', 'admin');
    mockAdminAuth('admin-1');

    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', moderation_status: 'approved', is_public: true }]
    });

    const res = await request(app)
      .put('/api/admin/criminal-records/r1/moderate')
      .set(headers)
      .send({ status: 'approved', notes: 'Verified with court records' });

    expect(res.status).toBe(200);
    expect(res.body.moderation_status).toBe('approved');
  });

  test('PUT /api/admin/criminal-records/:id/moderate rejects invalid status', async () => {
    const headers = authHeaders('admin-1', 'admin');
    mockAdminAuth('admin-1');

    const res = await request(app)
      .put('/api/admin/criminal-records/r1/moderate')
      .set(headers)
      .send({ status: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Status must be approved or rejected');
  });

  test('POST /api/admin/criminal-records creates system-pulled record', async () => {
    const headers = authHeaders('admin-1', 'admin');
    mockAdminAuth('admin-1');

    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', offense: 'Fraud', source: 'system_pulled', is_public: false, moderation_status: 'pending' }]
    });

    const res = await request(app)
      .post('/api/admin/criminal-records')
      .set(headers)
      .send({ candidateId: 'c1', offense: 'Fraud', disposition: 'convicted' });

    expect(res.status).toBe(201);
    expect(res.body.source).toBe('system_pulled');
    expect(res.body.is_public).toBe(false);
    expect(res.body.moderation_status).toBe('pending');
  });

  test('POST /api/admin/criminal-records rejects missing fields', async () => {
    const headers = authHeaders('admin-1', 'admin');
    mockAdminAuth('admin-1');

    const res = await request(app)
      .post('/api/admin/criminal-records')
      .set(headers)
      .send({ candidateId: 'c1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('candidateId, offense, and disposition required');
  });

  test('admin endpoints reject non-admin users', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');

    const res = await request(app)
      .get('/api/admin/criminal-records/queue')
      .set(headers);

    expect(res.status).toBe(403);
  });
});
