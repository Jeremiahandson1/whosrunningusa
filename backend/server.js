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
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) {
          delete event.request.headers['authorization'];
          delete event.request.headers['cookie'];
        }
      }
      return event;
    },
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
      scriptSrc: ["'self'", "'unsafe-inline'", "https://plausible.io", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3000', "https://cdn.jsdelivr.net"],
    }
  }
}));
// Widget endpoints + widget-consumed APIs: open CORS for any origin (embeddable on any site)
app.use('/api/widgets', cors({ origin: true, credentials: false }));
app.use('/widgets', cors({ origin: true, credentials: false }));
const widgetReadOnlyPaths = ['/api/cost-calculator', '/api/promises', '/api/dark-money', '/api/conflicts', '/api/rubber-stamp', '/api/foreign-aid'];
widgetReadOnlyPaths.forEach(p => app.use(p, cors({ origin: true, credentials: false })));

// Default CORS — allow the configured frontend plus any additional origins
// listed in FRONTEND_URLS (comma-separated). Covers custom domain + the
// .onrender.com subdomain, which are different origins to the browser.
const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(',').map(s => s.trim()) : []),
    'https://whosrunningusa.com',
    'https://www.whosrunningusa.com',
    'https://whosrunningusa.onrender.com',
  ].filter(Boolean)
);
app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin / non-browser requests (no Origin header)
    if (!origin) return cb(null, true);
    if (allowedOrigins.has(origin)) return cb(null, true);
    return cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));

// Health check — placed before rate limiter so Render health checks never get 429'd
// Build marker: rubber-stamp-fix-3e8943b
const db = require('./db');
app.get('/api/health', async (req, res) => {
  const body = { status: 'ok', timestamp: new Date().toISOString(), db: 'unknown' };
  try {
    const r = await db.query('SELECT 1 AS ok');
    body.db = r.rows[0].ok === 1 ? 'ok' : 'unexpected';
  } catch (err) {
    body.status = 'degraded';
    body.db = 'error';
    body.db_error = err.message;
    return res.status(503).json(body);
  }
  res.json(body);
});

// Rate limiting (disabled in test environment)
if (process.env.NODE_ENV !== 'test') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs
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

  const widgetEventLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Widget rate limit exceeded' }
  });
  app.use('/api/widgets/event', widgetEventLimiter);
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

// Serve widget bundles with open CORS (embeddable on any site)
const path = require('path');
app.use('/widgets', express.static(path.join(__dirname, '..', 'dist', 'widgets'), {
  maxAge: '1h',
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
}));

// Serve uploaded files (local dev only; S3 in production)
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
app.use('/api/lookup', require('./routes/lookup'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/contact', require('./routes/contact'));
app.use('/api/criminal-records', require('./routes/criminalRecords'));
app.use('/api/connections', require('./routes/connections'));
app.use('/api/community-notes', require('./routes/communityNotes'));
app.use('/api/accountability', require('./routes/accountability'));
app.use('/api/petitions', require('./routes/petitions'));
app.use('/api/candidate-claims', require('./routes/candidate-claims'));
app.use('/api/revolving-door', require('./routes/revolving-door'));
app.use('/api/trades', require('./routes/trades'));
app.use('/api/transparency', require('./routes/transparency'));
app.use('/api/finance-map', require('./routes/finance-map'));
app.use('/api/blueprint', require('./routes/blueprint'));
app.use('/api/foreign-aid', require('./routes/foreign-aid'));
app.use('/api/dark-money', require('./routes/dark-money'));
app.use('/api/foreign-influence', require('./routes/foreign-influence'));
app.use('/api/revenue-violations', require('./routes/revenue-violations'));
app.use('/api/promises', require('./routes/promises'));
app.use('/api/cost-calculator', require('./routes/cost-calculator'));
app.use('/api/conflicts', require('./routes/conflicts'));
app.use('/api/rubber-stamp', require('./routes/rubber-stamp'));
app.use('/api/ballot-measures', require('./routes/ballot-measures'));
app.use('/api/gerrymandering', require('./routes/gerrymandering'));
app.use('/api/local-government', require('./routes/local-government'));
app.use('/api/voter-access', require('./routes/voter-access'));
app.use('/api/pac-pledge', require('./routes/pac-pledge'));
app.use('/api/widgets', require('./routes/widgets'));

// Blueprint policy hub — hidden static site at /blueprint
app.use('/blueprint', express.static(path.join(__dirname, 'blueprint'), { index: 'index.html' }));
app.get('/blueprint/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'blueprint', 'index.html'));
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