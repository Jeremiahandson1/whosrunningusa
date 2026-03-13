const validator = require('validator');

// Sanitize string input - trim and escape HTML
function sanitize(str) {
  if (typeof str !== 'string') return str;
  return str.trim();
}

// Recursively sanitize all string values in an object
function sanitizeBody(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitize(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(v => typeof v === 'string' ? sanitize(v) : v);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeBody(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// Middleware to sanitize request body
function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeBody(req.body);
  }
  next();
}

// Validate email format
function validateEmail(email) {
  return typeof email === 'string' && validator.isEmail(email);
}

// Validate UUID format
function validateUUID(id) {
  return typeof id === 'string' && validator.isUUID(id);
}

// Middleware to validate that :id params are valid UUIDs
function validateIdParam(req, res, next) {
  const { id } = req.params;
  if (id && !validateUUID(id)) {
    return res.status(400).json({ error: 'Invalid ID format' });
  }
  next();
}

module.exports = {
  sanitizeInput,
  validateEmail,
  validateUUID,
  validateIdParam,
};
