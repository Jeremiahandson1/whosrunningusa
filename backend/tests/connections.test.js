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

describe('GET /api/connections', () => {
  test('returns list of connections', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({
      rows: [
        { connection_id: 'conn-1', id: 'user-2', username: 'alice', display_name: 'Alice Smith', profile_pic_url: null, connected_at: '2026-01-01' },
      ]
    });

    const res = await request(app).get('/api/connections').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.connections).toHaveLength(1);
    expect(res.body.connections[0].username).toBe('alice');
  });

  test('returns empty list when no connections', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/connections').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.connections).toEqual([]);
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/connections');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/connections/requests', () => {
  test('returns pending incoming requests', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'req-1', user_id: 'user-2', username: 'bob', display_name: 'Bob Jones', created_at: '2026-01-01' },
      ]
    });

    const res = await request(app).get('/api/connections/requests').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
  });
});

describe('GET /api/connections/requests/sent', () => {
  test('returns pending sent requests', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'req-2', user_id: 'user-3', username: 'carol', display_name: 'Carol Lee', created_at: '2026-01-01' },
      ]
    });

    const res = await request(app).get('/api/connections/requests/sent').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.requests).toHaveLength(1);
  });
});

describe('GET /api/connections/status/:userId', () => {
  test('returns "connected" when users are connected', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    // Connection check
    db.query.mockResolvedValueOnce({ rows: [{ id: 'conn-1' }] });

    const res = await request(app).get('/api/connections/status/user-2').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('connected');
  });

  test('returns "pending_sent" when request was sent', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    // No connection
    db.query.mockResolvedValueOnce({ rows: [] });
    // Sent pending request
    db.query.mockResolvedValueOnce({ rows: [{ id: 'req-1' }] });

    const res = await request(app).get('/api/connections/status/user-2').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending_sent');
    expect(res.body.requestId).toBe('req-1');
  });

  test('returns "pending_received" when request was received', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    // No connection
    db.query.mockResolvedValueOnce({ rows: [] });
    // No sent request
    db.query.mockResolvedValueOnce({ rows: [] });
    // Received request
    db.query.mockResolvedValueOnce({ rows: [{ id: 'req-2' }] });

    const res = await request(app).get('/api/connections/status/user-2').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending_received');
    expect(res.body.requestId).toBe('req-2');
  });

  test('returns "none" when no relationship exists', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({ rows: [] }); // no connection
    db.query.mockResolvedValueOnce({ rows: [] }); // no sent request
    db.query.mockResolvedValueOnce({ rows: [] }); // no received request

    const res = await request(app).get('/api/connections/status/user-2').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('none');
  });
});

describe('POST /api/connections/request/:userId', () => {
  test('sends a connection request successfully', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    // User exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'user-2' }] });
    // Not already connected
    db.query.mockResolvedValueOnce({ rows: [] });
    // No existing pending request
    db.query.mockResolvedValueOnce({ rows: [] });
    // Insert request
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'req-1', requester_id: 'user-1', requested_id: 'user-2', status: 'pending' }]
    });

    const res = await request(app).post('/api/connections/request/user-2').set(headers);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  test('prevents self-request', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');

    const res = await request(app).post('/api/connections/request/user-1').set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Cannot send a connection request to yourself');
  });

  test('returns 404 for non-existent user', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({ rows: [] }); // user not found

    const res = await request(app).post('/api/connections/request/user-999').set(headers);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('User not found');
  });

  test('prevents duplicate request when already connected', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'user-2' }] }); // user exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'conn-1' }] }); // already connected

    const res = await request(app).post('/api/connections/request/user-2').set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Already connected');
  });

  test('prevents duplicate pending request', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'user-2' }] }); // user exists
    db.query.mockResolvedValueOnce({ rows: [] }); // not connected
    db.query.mockResolvedValueOnce({ rows: [{ id: 'req-1' }] }); // pending request exists

    const res = await request(app).post('/api/connections/request/user-2').set(headers);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('A pending request already exists');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).post('/api/connections/request/user-2');
    expect(res.status).toBe(401);
  });
});

function mockClient() {
  const client = {
    query: jest.fn(),
    release: jest.fn(),
  };
  db.getClient.mockResolvedValue(client);
  return client;
}

describe('PUT /api/connections/request/:requestId/accept', () => {
  test('accepts a connection request', async () => {
    const headers = authHeaders('user-2');
    mockAuthUser('user-2');
    const client = mockClient();
    // BEGIN
    client.query.mockResolvedValueOnce({ rows: [] });
    // Get request
    client.query.mockResolvedValueOnce({
      rows: [{ id: 'req-1', requester_id: 'user-1', requested_id: 'user-2', status: 'pending' }]
    });
    // Update request status
    client.query.mockResolvedValueOnce({ rows: [] });
    // Insert connection
    client.query.mockResolvedValueOnce({
      rows: [{ id: 'conn-1', user_a_id: 'user-1', user_b_id: 'user-2' }]
    });
    // COMMIT
    client.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).put('/api/connections/request/req-1/accept').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Connection accepted');
  });

  test('returns 404 for non-existent request', async () => {
    const headers = authHeaders('user-2');
    mockAuthUser('user-2');
    const client = mockClient();
    // BEGIN
    client.query.mockResolvedValueOnce({ rows: [] });
    // Get request - not found
    client.query.mockResolvedValueOnce({ rows: [] });
    // ROLLBACK
    client.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).put('/api/connections/request/req-999/accept').set(headers);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Request not found');
  });

  test('rejects if not the requested user', async () => {
    const headers = authHeaders('user-3');
    mockAuthUser('user-3');
    const client = mockClient();
    // BEGIN
    client.query.mockResolvedValueOnce({ rows: [] });
    // Get request
    client.query.mockResolvedValueOnce({
      rows: [{ id: 'req-1', requester_id: 'user-1', requested_id: 'user-2', status: 'pending' }]
    });
    // ROLLBACK
    client.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).put('/api/connections/request/req-1/accept').set(headers);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not authorized to accept this request');
  });
});

describe('PUT /api/connections/request/:requestId/reject', () => {
  test('rejects a connection request', async () => {
    const headers = authHeaders('user-2');
    mockAuthUser('user-2');
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'req-1', requester_id: 'user-1', requested_id: 'user-2', status: 'pending' }]
    });
    db.query.mockResolvedValueOnce({ rows: [] }); // update status

    const res = await request(app).put('/api/connections/request/req-1/reject').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Connection request rejected');
  });

  test('rejects if not the requested user', async () => {
    const headers = authHeaders('user-3');
    mockAuthUser('user-3');
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'req-1', requester_id: 'user-1', requested_id: 'user-2', status: 'pending' }]
    });

    const res = await request(app).put('/api/connections/request/req-1/reject').set(headers);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not authorized to reject this request');
  });
});

describe('DELETE /api/connections/:userId', () => {
  test('removes a connection', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'conn-1' }] });

    const res = await request(app).delete('/api/connections/user-2').set(headers);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Connection removed');
  });

  test('returns 404 when connection does not exist', async () => {
    const headers = authHeaders('user-1');
    mockAuthUser('user-1');
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).delete('/api/connections/user-999').set(headers);
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Connection not found');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).delete('/api/connections/user-2');
    expect(res.status).toBe(401);
  });
});
