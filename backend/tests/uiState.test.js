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

describe('PUT /api/users/me/ui-state', () => {
  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .put('/api/users/me/ui-state')
      .send({ onboarding_seen_voting_guide: true });
    expect(res.status).toBe(401);
  });

  test('rejects non-object body', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');

    const res = await request(app)
      .put('/api/users/me/ui-state')
      .set(headers)
      .send([1, 2, 3]);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/object/i);
  });

  test('persists whitelisted onboarding_seen_* keys', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({
      rows: [{ ui_state: { onboarding_seen_voting_guide: true } }]
    });

    const res = await request(app)
      .put('/api/users/me/ui-state')
      .set(headers)
      .send({ onboarding_seen_voting_guide: true });

    expect(res.status).toBe(200);
    expect(res.body.ui_state).toEqual({ onboarding_seen_voting_guide: true });

    // Verify the merged payload going into the DB matches what we sent
    const updateCall = db.query.mock.calls[1];
    expect(updateCall[1][0]).toContain('onboarding_seen_voting_guide');
  });

  test('persists last_voting_guide_election', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({
      rows: [{ ui_state: { last_voting_guide_election: 'election-123' } }]
    });

    const res = await request(app)
      .put('/api/users/me/ui-state')
      .set(headers)
      .send({ last_voting_guide_election: 'election-123' });

    expect(res.status).toBe(200);
    expect(res.body.ui_state.last_voting_guide_election).toBe('election-123');
  });

  test('silently drops keys outside the whitelist', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ ui_state: {} }] });

    const res = await request(app)
      .put('/api/users/me/ui-state')
      .set(headers)
      .send({
        is_admin: true,           // hostile attempt — must be dropped
        password: 'hax',          // hostile attempt — must be dropped
        random_pref: 'whatever',  // not whitelisted — must be dropped
      });

    expect(res.status).toBe(200);
    // Whatever DB merge happened, none of the hostile keys should be in the payload
    const updateCall = db.query.mock.calls[1];
    const sentJson = updateCall[1][0];
    expect(sentJson).not.toContain('is_admin');
    expect(sentJson).not.toContain('password');
    expect(sentJson).not.toContain('random_pref');
  });

  test('mixes allowed and disallowed keys correctly', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({
      rows: [{ ui_state: { onboarding_seen_explore: true } }]
    });

    const res = await request(app)
      .put('/api/users/me/ui-state')
      .set(headers)
      .send({
        onboarding_seen_explore: true,  // allowed
        user_type: 'admin',             // dropped
      });

    expect(res.status).toBe(200);
    const sentJson = db.query.mock.calls[1][1][0];
    expect(sentJson).toContain('onboarding_seen_explore');
    expect(sentJson).not.toContain('user_type');
  });
});

describe('GET /api/auth/me returns ui_state', () => {
  test('includes ui_state on the user object', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 'user-1',
        email: 'test@test.com',
        username: 'testuser',
        user_type: 'voter',
        first_name: 'Test',
        last_name: 'User',
        ui_state: { onboarding_seen_voting_guide: true },
      }]
    });

    const res = await request(app)
      .get('/api/auth/me')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.user.ui_state).toEqual({ onboarding_seen_voting_guide: true });
  });
});
