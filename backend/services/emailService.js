// Email service - uses console logging in dev, ready for SendGrid/SES in production
const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Dev mode: log emails to console
    transporter = {
      sendMail: async (options) => {
        console.log('=== EMAIL (dev mode) ===');
        console.log(`To: ${options.to}`);
        console.log(`Subject: ${options.subject}`);
        console.log(`Body: ${options.text || options.html}`);
        console.log('========================');
        return { messageId: 'dev-' + Date.now() };
      },
    };
  }

  return transporter;
}

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@whosrunningusa.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

const emailService = {
  async sendVerificationEmail(email, token, userId) {
    const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}&userId=${userId}`;
    await getTransporter().sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your WhosRunningUSA account',
      html: `
        <h2>Welcome to WhosRunningUSA!</h2>
        <p>Click the link below to verify your email address:</p>
        <p><a href="${verifyUrl}" style="background:#2c4a72;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Verify Email</a></p>
        <p>Or copy this link: ${verifyUrl}</p>
        <p>This link expires in 24 hours.</p>
        <hr>
        <p style="color:#718096;font-size:12px;">WhosRunningUSA - Every race. Every candidate. No hiding.</p>
      `,
      text: `Welcome to WhosRunningUSA! Verify your email: ${verifyUrl}`,
    });
  },

  async sendPasswordResetEmail(email, token, userId) {
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}&userId=${userId}`;
    await getTransporter().sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your WhosRunningUSA password',
      html: `
        <h2>Password Reset</h2>
        <p>You requested a password reset. Click the link below:</p>
        <p><a href="${resetUrl}" style="background:#2c4a72;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Reset Password</a></p>
        <p>Or copy this link: ${resetUrl}</p>
        <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
        <hr>
        <p style="color:#718096;font-size:12px;">WhosRunningUSA - Every race. Every candidate. No hiding.</p>
      `,
      text: `Reset your password: ${resetUrl}`,
    });
  },

  async sendNotification(email, subject, message) {
    await getTransporter().sendMail({
      from: FROM_EMAIL,
      to: email,
      subject,
      html: `
        <h3>${subject}</h3>
        <p>${message}</p>
        <hr>
        <p style="color:#718096;font-size:12px;">WhosRunningUSA - Every race. Every candidate. No hiding.</p>
      `,
      text: message,
    });
  },

  async sendQuestionAnsweredNotification(email, candidateName, questionText) {
    await getTransporter().sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: `${candidateName} answered your question on WhosRunningUSA`,
      html: `
        <h3>Your question was answered!</h3>
        <p><strong>${candidateName}</strong> responded to your question:</p>
        <blockquote style="border-left:3px solid #3d5a80;padding-left:12px;color:#4a5568;">${questionText}</blockquote>
        <p><a href="${FRONTEND_URL}" style="background:#2c4a72;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">View Answer</a></p>
        <hr>
        <p style="color:#718096;font-size:12px;">WhosRunningUSA - Every race. Every candidate. No hiding.</p>
      `,
      text: `${candidateName} answered your question: "${questionText}" - View at ${FRONTEND_URL}`,
    });
  },

  async sendTownHallNotification(email, candidateName, townHallTitle, scheduledAt) {
    await getTransporter().sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: `${candidateName} is hosting a town hall on WhosRunningUSA`,
      html: `
        <h3>New Town Hall Scheduled</h3>
        <p><strong>${candidateName}</strong> is hosting: <strong>${townHallTitle}</strong></p>
        <p>Date: ${new Date(scheduledAt).toLocaleString()}</p>
        <p><a href="${FRONTEND_URL}/town-halls" style="background:#2c4a72;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">View Details & RSVP</a></p>
        <hr>
        <p style="color:#718096;font-size:12px;">WhosRunningUSA - Every race. Every candidate. No hiding.</p>
      `,
      text: `${candidateName} is hosting: ${townHallTitle} on ${new Date(scheduledAt).toLocaleString()} - ${FRONTEND_URL}/town-halls`,
    });
  },

  async sendNewPostNotification(email, candidateName, postTitle) {
    await getTransporter().sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: `${candidateName} posted an update on WhosRunningUSA`,
      html: `
        <h3>New Post from ${candidateName}</h3>
        ${postTitle ? `<p><strong>${postTitle}</strong></p>` : ''}
        <p><a href="${FRONTEND_URL}" style="background:#2c4a72;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">View Post</a></p>
        <hr>
        <p style="color:#718096;font-size:12px;">WhosRunningUSA - Every race. Every candidate. No hiding.</p>
      `,
      text: `${candidateName} posted an update${postTitle ? `: ${postTitle}` : ''} - ${FRONTEND_URL}`,
    });
  },
};

module.exports = emailService;
