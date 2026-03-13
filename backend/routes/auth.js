const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const validator = require('validator');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const emailService = require('../services/emailService');

// Register new user
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, username, userType, user_type, firstName, first_name, lastName, last_name, city, state } = req.body;
    const resolvedUserType = userType || user_type || 'voter';
    const resolvedFirstName = firstName || first_name;
    const resolvedLastName = lastName || last_name;
    
    // Validation
    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, password, and username are required' });
    }
    
    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({ error: 'Username must be 3-50 characters' });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }
    
    if (!['voter', 'candidate'].includes(resolvedUserType)) {
      return res.status(400).json({ error: 'Invalid user type' });
    }
    
    // Check if email or username exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)',
      [email, username]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email or username already exists' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const result = await db.query(
      `INSERT INTO users (email, password_hash, username, user_type, first_name, last_name, city, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, username, user_type, first_name, last_name, created_at`,
      [email.toLowerCase(), passwordHash, username, resolvedUserType, resolvedFirstName, resolvedLastName, city, state]
    );
    
    const user = result.rows[0];
    
    // If candidate, create candidate profile
    if (resolvedUserType === 'candidate') {
      await db.query(
        'INSERT INTO candidate_profiles (user_id, display_name) VALUES ($1, $2)',
        [user.id, `${resolvedFirstName || ''} ${resolvedLastName || ''}`.trim() || username]
      );
    }
    
    // Create email verification token
    const verificationToken = uuidv4();
    const tokenHash = await bcrypt.hash(verificationToken, 10);
    
    await db.query(
      `INSERT INTO email_verifications (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '24 hours')`,
      [user.id, tokenHash]
    );
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, userType: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Send verification email
    emailService.sendVerificationEmail(email, verificationToken, user.id).catch(err => {
      console.error('Failed to send verification email:', err.message);
    });

    res.status(201).json({
      message: 'Registration successful. Please verify your email.',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        user_type: user.user_type,
        first_name: user.first_name,
        last_name: user.last_name,
      }
    });
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user (case-insensitive email)
    const result = await db.query(
      `SELECT id, email, username, password_hash, user_type, is_active, is_banned, ban_reason
       FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    const user = result.rows[0];
    
    // Check password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check account status
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is not active' });
    }
    
    if (user.is_banned) {
      return res.status(403).json({ error: 'Account is banned', reason: user.ban_reason });
    }
    
    // Update last login
    await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user.id, userType: user.user_type },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    // Get full user for response
    const fullUser = await db.query(
      `SELECT id, email, username, user_type, first_name, last_name, state, city FROM users WHERE id = $1`,
      [user.id]
    );

    res.json({
      token,
      user: fullUser.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, email, username, user_type, first_name, last_name, 
              profile_pic_url, bio, state, county, city, zip_code,
              email_verified, phone_verified, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = result.rows[0];
    
    // If candidate, get candidate profile
    let candidateProfile = null;
    if (user.user_type === 'candidate') {
      const profileResult = await db.query(
        `SELECT * FROM candidate_profiles WHERE user_id = $1`,
        [user.id]
      );
      if (profileResult.rows.length > 0) {
        candidateProfile = profileResult.rows[0];
      }
    }
    
    res.json({
      user: {
        ...user,
        candidate_profile_id: candidateProfile?.id || null,
        candidateProfile
      }
    });
  } catch (error) {
    next(error);
  }
});

// Verify email
router.post('/verify-email', async (req, res, next) => {
  try {
    const { token, userId } = req.body;
    
    if (!token || !userId) {
      return res.status(400).json({ error: 'Token and userId are required' });
    }
    
    // Find verification record
    const result = await db.query(
      `SELECT id, token_hash, expires_at, verified_at 
       FROM email_verifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No verification found' });
    }
    
    const verification = result.rows[0];
    
    if (verification.verified_at) {
      return res.status(400).json({ error: 'Email already verified' });
    }
    
    if (new Date() > new Date(verification.expires_at)) {
      return res.status(400).json({ error: 'Verification token expired' });
    }
    
    const validToken = await bcrypt.compare(token, verification.token_hash);
    if (!validToken) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }
    
    // Update user and verification
    await db.query(
      'UPDATE users SET email_verified = TRUE, email_verified_at = NOW() WHERE id = $1',
      [userId]
    );
    
    await db.query(
      'UPDATE email_verifications SET verified_at = NOW() WHERE id = $1',
      [verification.id]
    );
    
    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    next(error);
  }
});

// Request password reset
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Find user
    const result = await db.query(
      'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    
    // Always return success to prevent email enumeration
    if (result.rows.length === 0) {
      return res.json({ message: 'If an account exists, a reset email has been sent' });
    }
    
    const user = result.rows[0];
    
    // Create reset token
    const resetToken = uuidv4();
    const tokenHash = await bcrypt.hash(resetToken, 10);
    
    await db.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.id, tokenHash]
    );
    
    // Send reset email
    emailService.sendPasswordResetEmail(user.email, resetToken, user.id).catch(err => {
      console.error('Failed to send reset email:', err.message);
    });

    res.json({ message: 'If an account exists, a reset email has been sent' });
  } catch (error) {
    next(error);
  }
});

// Reset password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, userId, newPassword } = req.body;
    
    if (!token || !userId || !newPassword) {
      return res.status(400).json({ error: 'Token, userId, and newPassword are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Find reset record
    const result = await db.query(
      `SELECT id, token_hash, expires_at, used_at 
       FROM password_resets 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'No reset request found' });
    }
    
    const reset = result.rows[0];
    
    if (reset.used_at) {
      return res.status(400).json({ error: 'Reset token already used' });
    }
    
    if (new Date() > new Date(reset.expires_at)) {
      return res.status(400).json({ error: 'Reset token expired' });
    }
    
    const validToken = await bcrypt.compare(token, reset.token_hash);
    if (!validToken) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }
    
    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    
    // Mark reset as used
    await db.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [reset.id]);
    
    res.json({ message: 'Password reset successful' });
  } catch (error) {
    next(error);
  }
});

// Change password (authenticated)
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    
    // Get current password hash
    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const validPassword = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
