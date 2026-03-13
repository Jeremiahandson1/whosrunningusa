const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../server');
const db = require('../db');
const emailService = require('../services/emailService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/auth/register', () => {
  test('registers a new user successfully', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // check existing email/username (single query)
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'test@test.com', username: 'testuser', user_type: 'voter', first_name: 'Test', last_name: 'User', created_at: new Date() }] }) // insert user
      .mockResolvedValueOnce({ rows: [] }); // insert email verification

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'password123', username: 'testuser', firstName: 'Test', lastName: 'User' });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@test.com');
    expect(emailService.sendVerificationEmail).toHaveBeenCalled();
  });

  test('rejects registration with existing email', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // existing email/username

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existing@test.com', password: 'password123', username: 'newuser' });

    expect(res.status).toBe(409);
  });

  test('rejects weak password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: '123', username: 'testuser' });

    expect(res.status).toBe(400);
  });

  test('rejects missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
  });

  test('rejects invalid email format', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'notanemail', password: 'password123', username: 'testuser' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  test('logs in with valid credentials', async () => {
    const passwordHash = await bcrypt.hash('password123', 4); // low rounds for speed
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'test@test.com', username: 'testuser', user_type: 'voter', password_hash: passwordHash, is_active: true, is_banned: false }] }) // find user
      .mockResolvedValueOnce({ rows: [] }) // update last_login_at
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'test@test.com', username: 'testuser', user_type: 'voter', first_name: 'Test', last_name: 'User', state: null, city: null }] }); // get full user

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@test.com');
  });

  test('rejects invalid password', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'test@test.com', password_hash: passwordHash, is_active: true, is_banned: false }]
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  test('rejects non-existent user', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });

  test('rejects banned user', async () => {
    const passwordHash = await bcrypt.hash('password123', 4);
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'user-1', email: 'test@test.com', password_hash: passwordHash, is_active: true, is_banned: true, ban_reason: 'test' }]
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'password123' });

    expect(res.status).toBe(403);
  });

  test('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/forgot-password', () => {
  test('returns success even for non-existent email (prevents enumeration)', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@test.com' });

    expect(res.status).toBe(200);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  test('sends reset email for valid user', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'test@test.com' }] }) // find user
      .mockResolvedValueOnce({ rows: [] }); // insert reset token

    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(200);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith('test@test.com', expect.any(String), 'user-1');
  });
});

describe('GET /api/auth/me', () => {
  test('rejects requests without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('rejects invalid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalidtoken');
    expect(res.status).toBe(401);
  });

  test('accepts valid token and returns user profile', async () => {
    const token = jwt.sign({ userId: 'user-1', userType: 'voter' }, process.env.JWT_SECRET, { expiresIn: '1h' });

    db.query
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'test@test.com', username: 'testuser', user_type: 'voter', is_active: true, is_banned: false }] }) // auth middleware lookup
      .mockResolvedValueOnce({ rows: [{ id: 'user-1', email: 'test@test.com', username: 'testuser', user_type: 'voter', first_name: 'Test', last_name: 'User', email_verified: true, created_at: new Date() }] }); // /me query

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@test.com');
  });
});
