const request = require('supertest');
const app = require('../server');
const emailService = require('../services/emailService');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('POST /api/contact', () => {
  test('sends contact message successfully', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Question about platform',
        message: 'How do I find my local candidates?'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Message sent successfully');
    expect(emailService.sendNotification).toHaveBeenCalledWith(
      expect.any(String),
      'Contact Form: Question about platform',
      expect.stringContaining('Jane Doe')
    );
  });

  test('rejects when name is missing', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({
        email: 'jane@example.com',
        subject: 'Hello',
        message: 'Test message'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('All fields are required');
  });

  test('rejects when email is missing', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({
        name: 'Jane Doe',
        subject: 'Hello',
        message: 'Test message'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('All fields are required');
  });

  test('rejects when subject is missing', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        message: 'Test message'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('All fields are required');
  });

  test('rejects when message is missing', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Hello'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('All fields are required');
  });

  test('rejects invalid email address', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({
        name: 'Jane Doe',
        email: 'not-an-email',
        subject: 'Hello',
        message: 'Test message'
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid email address');
  });

  test('still acknowledges receipt when email sending fails', async () => {
    emailService.sendNotification.mockRejectedValueOnce(new Error('SMTP down'));

    const res = await request(app)
      .post('/api/contact')
      .send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        subject: 'Hello',
        message: 'Test message'
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Message received');
  });

  test('includes sender info in notification email body', async () => {
    await request(app)
      .post('/api/contact')
      .send({
        name: 'John Smith',
        email: 'john@example.com',
        subject: 'Feedback',
        message: 'Great platform!'
      });

    expect(emailService.sendNotification).toHaveBeenCalledWith(
      expect.any(String),
      'Contact Form: Feedback',
      expect.stringContaining('john@example.com')
    );
    expect(emailService.sendNotification).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.stringContaining('Great platform!')
    );
  });
});
