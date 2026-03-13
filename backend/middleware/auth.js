const jwt = require('jsonwebtoken');
const db = require('../db');

// Verify JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const result = await db.query(
      'SELECT id, email, username, user_type, is_active, is_banned FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    if (!user.is_active || user.is_banned) {
      return res.status(403).json({ error: 'Account is not active' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    next(error);
  }
};

// Optional authentication (for public routes that can have enhanced features when logged in)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await db.query(
      'SELECT id, email, username, user_type, is_active, is_banned FROM users WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length > 0 && result.rows[0].is_active && !result.rows[0].is_banned) {
      req.user = result.rows[0];
    }
    
    next();
  } catch (error) {
    // Silently continue without user
    next();
  }
};

// Require specific user type
const requireUserType = (...types) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!types.includes(req.user.user_type)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

// Require admin
const requireAdmin = requireUserType('admin');

// Require candidate
const requireCandidate = requireUserType('candidate', 'admin');

// Require verified email
const requireVerifiedEmail = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT email_verified FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (!result.rows[0]?.email_verified) {
      return res.status(403).json({ error: 'Email verification required' });
    }
    
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  authenticate,
  optionalAuth,
  requireUserType,
  requireAdmin,
  requireCandidate,
  requireVerifiedEmail
};
