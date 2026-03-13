const express = require('express');
const router = express.Router();
const db = require('../db');
const emailService = require('../services/emailService');
const validator = require('validator');

// Submit contact form
router.post('/', async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Send notification email to support
    await emailService.sendNotification(
      process.env.FROM_EMAIL || 'support@whosrunningusa.com',
      `Contact Form: ${subject}`,
      `From: ${name} <${email}>\n\n${message}`
    );

    res.json({ message: 'Message sent successfully' });
  } catch (error) {
    // Even if email fails, acknowledge receipt
    console.error('Contact form email error:', error.message);
    res.json({ message: 'Message received' });
  }
});

// Newsletter signup
router.post('/newsletter', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    await db.query(
      `INSERT INTO newsletter_subscribers (email)
       VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET unsubscribed_at = NULL, subscribed_at = CURRENT_TIMESTAMP`,
      [email.toLowerCase().trim()]
    );

    res.json({ message: "You're subscribed!" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
