// Mock ESM-only packages
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).slice(2, 10),
}));

// Mock database before anything else loads
jest.mock('../db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { end: jest.fn() }
}));

// Mock email service
jest.mock('../services/emailService', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue({}),
  sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
  sendNotification: jest.fn().mockResolvedValue({}),
  sendQuestionAnsweredNotification: jest.fn().mockResolvedValue({}),
  sendTownHallNotification: jest.fn().mockResolvedValue({}),
  sendNewPostNotification: jest.fn().mockResolvedValue({}),
}));

// Mock notification service
jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue({}),
  notifyFollowers: jest.fn().mockResolvedValue({}),
  notifyQuestionAsker: jest.fn().mockResolvedValue({}),
}));

// Set test env vars
process.env.JWT_SECRET = 'test-secret-key-for-testing';
process.env.NODE_ENV = 'test';
