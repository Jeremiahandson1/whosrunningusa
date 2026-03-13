require('dotenv').config();

// Validate required environment variables at startup
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'];
const missing = REQUIRED_ENV.filter(key => !process.env[key]);
if (missing.length > 0) {
  console.error(`FATAL: Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

const Sentry = require('@sentry/node');
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    enabled: process.env.NODE_ENV === 'production',
  });
}
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { sanitizeInput } = require('./middleware/validate');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://plausible.io"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000'],
    }
  }
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use('/api/', limiter);

  // Per-route rate limiting for sensitive endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too many attempts, please try again later.' }
  });
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);

  const contactLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: { error: 'Too many messages, please try again later.' }
  });
  app.use('/api/contact', contactLimiter);

  const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { error: 'Too many uploads, please try again later.' }
  });
  app.use('/api/uploads', uploadLimiter);
}

// Body parsing (skip for Stripe webhook which needs raw body)
app.use((req, res, next) => {
  if (req.originalUrl === '/api/candidates/verify/webhook') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Input sanitization
app.use(sanitizeInput);

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Serve uploaded files (local dev only; S3 in production)
const path = require('path');
if (!process.env.AWS_ACCESS_KEY_ID) {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/uploads', require('./routes/uploads'));
app.use('/api/users', require('./routes/users'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/elections', require('./routes/elections'));
app.use('/api/races', require('./routes/races'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/town-halls', require('./routes/townHalls'));
app.use('/api/issues', require('./routes/issues'));
app.use('/api/search', require('./routes/search'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/criminal-records', require('./routes/criminalRecords'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/community-notes', require('./routes/communityNotes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err, req, res, next) => {
  Sentry.captureException(err);
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Something went wrong' 
      : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`WhosRunningUSA API server running on port ${PORT}`);
});

module.exports = app;