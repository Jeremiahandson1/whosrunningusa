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

describe('GET /api/posts/candidate/:candidateId', () => {
  test('returns posts for a candidate', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'p1', candidate_id: 'c1', title: 'My First Post', content: 'Hello voters', post_type: 'update', is_published: true },
        { id: 'p2', candidate_id: 'c1', title: 'Policy Update', content: 'New policy', post_type: 'policy', is_published: true },
      ]
    });

    const res = await request(app).get('/api/posts/candidate/c1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('My First Post');
  });

  test('returns empty array when candidate has no posts', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/posts/candidate/c1');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('respects limit and offset parameters', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/posts/candidate/c1?limit=5&offset=10');
    expect(res.status).toBe(200);
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[1]).toContain(5);
    expect(callArgs[1]).toContain(10);
  });
});

describe('GET /api/posts/feed', () => {
  test('returns feed for authenticated user', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'p1', title: 'Update from Alice', candidate_name: 'Alice Smith', candidate_id: 'c1' },
      ]
    });

    const res = await request(app).get('/api/posts/feed').set(headers);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].candidate_name).toBe('Alice Smith');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).get('/api/posts/feed');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/posts', () => {
  test('creates a post successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    // Get candidate profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Insert post
    db.query.mockResolvedValueOnce({
      rows: [{
        id: 'p1', candidate_id: 'cp-1', title: 'New Policy', content: 'Details here',
        post_type: 'update', created_at: new Date().toISOString()
      }]
    });

    const res = await request(app)
      .post('/api/posts')
      .set(headers)
      .send({ title: 'New Policy', content: 'Details here', postType: 'update' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('New Policy');
    expect(res.body.candidate_id).toBe('cp-1');
  });

  test('rejects post without content', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');

    const res = await request(app)
      .post('/api/posts')
      .set(headers)
      .send({ title: 'No Content' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('content is required');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/posts')
      .send({ title: 'Test', content: 'Test content' });

    expect(res.status).toBe(401);
  });

  test('rejects non-candidate user', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');

    const res = await request(app)
      .post('/api/posts')
      .set(headers)
      .send({ title: 'Test', content: 'Test content' });

    expect(res.status).toBe(403);
  });

  test('returns 404 when candidate profile not found', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [] }); // no profile

    const res = await request(app)
      .post('/api/posts')
      .set(headers)
      .send({ title: 'Test', content: 'Test content' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Candidate profile not found');
  });
});

describe('PUT /api/posts/:id', () => {
  test('updates a post successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    // Get candidate profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] });
    // Get post (verify ownership)
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-1' }] });
    // Update post
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'p1', candidate_id: 'cp-1', title: 'Updated Title', content: 'Updated content' }]
    });

    const res = await request(app)
      .put('/api/posts/p1')
      .set(headers)
      .send({ title: 'Updated Title', content: 'Updated content' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Title');
  });

  test('rejects update for non-existent post', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] }); // profile
    db.query.mockResolvedValueOnce({ rows: [] }); // post not found

    const res = await request(app)
      .put('/api/posts/nonexistent')
      .set(headers)
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Post not found');
  });

  test('rejects update for post owned by another candidate', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] }); // my profile
    db.query.mockResolvedValueOnce({ rows: [{ candidate_id: 'cp-other' }] }); // someone else's post

    const res = await request(app)
      .put('/api/posts/p1')
      .set(headers)
      .send({ title: 'Hijack!' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not your post');
  });
});

describe('DELETE /api/posts/:id', () => {
  test('deletes a post successfully', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] }); // profile
    db.query.mockResolvedValueOnce({ rows: [{ id: 'p1' }] }); // delete returns row

    const res = await request(app)
      .delete('/api/posts/p1')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Post deleted');
  });

  test('returns 404 when deleting non-existent or non-owned post', async () => {
    const headers = authHeaders('user-1', 'candidate');
    mockAuthUser('user-1', 'candidate');
    db.query.mockResolvedValueOnce({ rows: [{ id: 'cp-1' }] }); // profile
    db.query.mockResolvedValueOnce({ rows: [] }); // delete found nothing

    const res = await request(app)
      .delete('/api/posts/nonexistent')
      .set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Post not found or not yours');
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app).delete('/api/posts/p1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/posts/:id/flag', () => {
  test('flags a post successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [] }); // insert flag

    const res = await request(app)
      .post('/api/posts/p1/flag')
      .set(headers)
      .send({ reason: 'spam', details: 'This is spam content' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Post flagged for review');
  });

  test('rejects unauthenticated flag request', async () => {
    const res = await request(app)
      .post('/api/posts/p1/flag')
      .send({ reason: 'spam' });

    expect(res.status).toBe(401);
  });
});
