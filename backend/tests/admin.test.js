const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');
const db = require('../db');

beforeEach(() => {
  jest.clearAllMocks();
});

const adminToken = () => jwt.sign({ userId: 'admin-1', userType: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
const voterToken = () => jwt.sign({ userId: 'voter-1', userType: 'voter' }, process.env.JWT_SECRET, { expiresIn: '1h' });

const mockAdminUser = {
  id: 'admin-1', email: 'admin@test.com', username: 'admin',
  user_type: 'admin', is_active: true, is_banned: false
};

const mockVoterUser = {
  id: 'voter-1', email: 'voter@test.com', username: 'voter',
  user_type: 'voter', is_active: true, is_banned: false
};

describe('Admin route protection', () => {
  test('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
  });

  test('rejects non-admin users', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockVoterUser] }); // auth lookup

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${voterToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });

  test('allows admin users via JWT', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [mockAdminUser] }) // auth middleware lookup
      .mockResolvedValueOnce({ rows: [{ total_candidates: 10, verified_candidates: 5, total_races: 3, active_elections: 1, total_offices: 20, total_users: 50 }] }); // stats query

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.total_candidates).toBeDefined();
  });

  test('allows requests with valid API key', async () => {
    process.env.ADMIN_API_KEY = 'test-admin-key';

    db.query.mockResolvedValueOnce({
      rows: [{ total_candidates: 10, verified_candidates: 5, total_races: 3, active_elections: 1, total_offices: 20, total_users: 50 }]
    });

    const res = await request(app)
      .get('/api/admin/stats')
      .set('x-admin-key', 'test-admin-key');

    expect(res.status).toBe(200);

    delete process.env.ADMIN_API_KEY;
  });

  test('rejects invalid API key', async () => {
    process.env.ADMIN_API_KEY = 'test-admin-key';

    const res = await request(app)
      .get('/api/admin/stats')
      .set('x-admin-key', 'wrong-key');

    expect(res.status).toBe(401);

    delete process.env.ADMIN_API_KEY;
  });
});

describe('Admin sync endpoints', () => {
  test('POST /api/admin/ingestion/sync/fec starts sync', async () => {
    db.query.mockResolvedValueOnce({ rows: [mockAdminUser] }); // auth

    const res = await request(app)
      .post('/api/admin/ingestion/sync/fec')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/FEC sync started/);
  });
});
