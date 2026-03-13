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

function mockAdminUser(userId = 'admin-1') {
  db.query.mockResolvedValueOnce({
    rows: [{ id: userId, email: 'admin@test.com', username: 'adminuser', user_type: 'admin', is_active: true, is_banned: false }]
  });
}

function mockVerifiedEmail() {
  db.query.mockResolvedValueOnce({ rows: [{ email_verified: true }] });
}

function mockUnverifiedEmail() {
  db.query.mockResolvedValueOnce({ rows: [{ email_verified: false }] });
}

describe('GET /api/community-notes/:contentType/:contentId', () => {
  test('returns visible notes for unauthenticated users', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'n1', note_text: 'This is context', author_username: 'user1', helpful_count: 5, not_helpful_count: 1, is_visible: true }
      ]
    });

    const res = await request(app).get('/api/community-notes/candidate/c1');
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(1);
    expect(res.body.notes[0].note_text).toBe('This is context');
  });

  test('returns all notes for admin users', async () => {
    const headers = authHeaders('admin-1', 'admin');
    mockAdminUser('admin-1');
    // Notes query (admin sees all, no is_visible filter)
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'n1', note_text: 'Visible note', is_visible: true },
        { id: 'n2', note_text: 'Hidden note', is_visible: false }
      ]
    });
    // User votes query
    db.query.mockResolvedValueOnce({
      rows: []
    });

    const res = await request(app)
      .get('/api/community-notes/candidate/c1')
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.notes).toHaveLength(2);
  });

  test('includes user_vote when authenticated', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', note_text: 'Note', helpful_count: 3, not_helpful_count: 0 }]
    });
    db.query.mockResolvedValueOnce({
      rows: [{ note_id: 'n1', vote: 'helpful' }]
    });

    const res = await request(app)
      .get('/api/community-notes/candidate/c1')
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.notes[0].user_vote).toBe('helpful');
  });

  test('returns empty list when no notes exist', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/community-notes/candidate/c1');
    expect(res.status).toBe(200);
    expect(res.body.notes).toEqual([]);
  });
});

describe('POST /api/community-notes', () => {
  test('creates a note successfully', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockVerifiedEmail();
    // Rate limit check
    db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    // Insert note
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'n1', content_type: 'candidate', content_id: 'c1', note_text: 'Context here', author_id: 'user-1', is_visible: false }]
    });

    const res = await request(app)
      .post('/api/community-notes')
      .set(headers)
      .send({ contentType: 'candidate', contentId: 'c1', noteText: 'Context here' });

    expect(res.status).toBe(201);
    expect(res.body.note_text).toBe('Context here');
    expect(res.body.is_visible).toBe(false);
  });

  test('rejects unauthenticated request', async () => {
    const res = await request(app)
      .post('/api/community-notes')
      .send({ contentType: 'candidate', contentId: 'c1', noteText: 'Test' });

    expect(res.status).toBe(401);
  });

  test('rejects unverified email', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockUnverifiedEmail();

    const res = await request(app)
      .post('/api/community-notes')
      .set(headers)
      .send({ contentType: 'candidate', contentId: 'c1', noteText: 'Test' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Email verification required');
  });

  test('rejects missing fields', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockVerifiedEmail();

    const res = await request(app)
      .post('/api/community-notes')
      .set(headers)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('contentType, contentId, and noteText are required');
  });

  test('rejects note over 2000 characters', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    mockVerifiedEmail();

    const res = await request(app)
      .post('/api/community-notes')
      .set(headers)
      .send({ contentType: 'candidate', contentId: 'c1', noteText: 'x'.repeat(2001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Note must be under 2000 characters');
  });
});

describe('POST /api/community-notes/:noteId/vote', () => {
  test('votes helpful on a note', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Note exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
    // No existing vote
    db.query.mockResolvedValueOnce({ rows: [] });
    // Insert vote
    db.query.mockResolvedValueOnce({ rows: [] });
    // Helpful count
    db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
    // Not helpful count
    db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    // Update note
    db.query.mockResolvedValueOnce({ rows: [] });
    // Get current vote
    db.query.mockResolvedValueOnce({ rows: [{ vote: 'helpful' }] });

    const res = await request(app)
      .post('/api/community-notes/n1/vote')
      .set(headers)
      .send({ vote: 'helpful' });

    expect(res.status).toBe(200);
    expect(res.body.helpful_count).toBe(1);
    expect(res.body.user_vote).toBe('helpful');
  });

  test('toggles vote off when same vote sent again', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Note exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
    // Existing vote is helpful
    db.query.mockResolvedValueOnce({ rows: [{ id: 'v1', vote: 'helpful' }] });
    // Delete vote (toggle off)
    db.query.mockResolvedValueOnce({ rows: [] });
    // Helpful count
    db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    // Not helpful count
    db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    // Update note
    db.query.mockResolvedValueOnce({ rows: [] });
    // Get current vote (none)
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/community-notes/n1/vote')
      .set(headers)
      .send({ vote: 'helpful' });

    expect(res.status).toBe(200);
    expect(res.body.helpful_count).toBe(0);
    expect(res.body.user_vote).toBeNull();
  });

  test('auto-visibility sets visible when helpful >= 3 and > not_helpful * 2', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Note exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
    // No existing vote
    db.query.mockResolvedValueOnce({ rows: [] });
    // Insert vote
    db.query.mockResolvedValueOnce({ rows: [] });
    // Helpful count = 3
    db.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });
    // Not helpful count = 1
    db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
    // Update note (should set is_visible = true since 3 >= 3 and 3 > 1*2)
    db.query.mockResolvedValueOnce({ rows: [] });
    // Get current vote
    db.query.mockResolvedValueOnce({ rows: [{ vote: 'helpful' }] });

    const res = await request(app)
      .post('/api/community-notes/n1/vote')
      .set(headers)
      .send({ vote: 'helpful' });

    expect(res.status).toBe(200);
    expect(res.body.is_visible).toBe(true);
    expect(res.body.helpful_count).toBe(3);
  });

  test('auto-visibility stays hidden when not enough helpful votes', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Note exists
    db.query.mockResolvedValueOnce({ rows: [{ id: 'n1' }] });
    // No existing vote
    db.query.mockResolvedValueOnce({ rows: [] });
    // Insert vote
    db.query.mockResolvedValueOnce({ rows: [] });
    // Helpful count = 2
    db.query.mockResolvedValueOnce({ rows: [{ count: '2' }] });
    // Not helpful count = 0
    db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });
    // Update note (is_visible = false since 2 < 3)
    db.query.mockResolvedValueOnce({ rows: [] });
    // Get current vote
    db.query.mockResolvedValueOnce({ rows: [{ vote: 'helpful' }] });

    const res = await request(app)
      .post('/api/community-notes/n1/vote')
      .set(headers)
      .send({ vote: 'helpful' });

    expect(res.status).toBe(200);
    expect(res.body.is_visible).toBe(false);
  });

  test('returns 404 for non-existent note', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [] }); // note not found

    const res = await request(app)
      .post('/api/community-notes/nonexistent/vote')
      .set(headers)
      .send({ vote: 'helpful' });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Note not found');
  });

  test('rejects invalid vote value', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');

    const res = await request(app)
      .post('/api/community-notes/n1/vote')
      .set(headers)
      .send({ vote: 'invalid' });

    expect(res.status).toBe(400);
  });

  test('rejects unauthenticated vote', async () => {
    const res = await request(app)
      .post('/api/community-notes/n1/vote')
      .send({ vote: 'helpful' });

    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/community-notes/:noteId', () => {
  test('author can delete own note', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    // Note exists and belongs to user
    db.query.mockResolvedValueOnce({ rows: [{ id: 'n1', author_id: 'user-1' }] });
    // Delete note
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/community-notes/n1')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Note deleted');
  });

  test('admin can delete any note', async () => {
    const headers = authHeaders('admin-1', 'admin');
    mockAdminUser('admin-1');
    // Note exists, belongs to someone else
    db.query.mockResolvedValueOnce({ rows: [{ id: 'n1', author_id: 'other-user' }] });
    // Delete note
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/community-notes/n1')
      .set(headers);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Note deleted');
  });

  test('non-author non-admin cannot delete note', async () => {
    const headers = authHeaders('user-2', 'voter');
    mockAuthUser('user-2', 'voter');
    // Note exists, belongs to different user
    db.query.mockResolvedValueOnce({ rows: [{ id: 'n1', author_id: 'user-1' }] });

    const res = await request(app)
      .delete('/api/community-notes/n1')
      .set(headers);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Not authorized to delete this note');
  });

  test('returns 404 for non-existent note', async () => {
    const headers = authHeaders('user-1', 'voter');
    mockAuthUser('user-1', 'voter');
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .delete('/api/community-notes/nonexistent')
      .set(headers);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Note not found');
  });
});
