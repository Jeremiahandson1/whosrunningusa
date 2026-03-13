const db = require('../db');
const emailService = require('./emailService');

const notificationService = {
  async createNotification(userId, { type, title, message, referenceType, referenceId }) {
    const result = await db.query(
      `INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [userId, type, title, message, referenceType, referenceId]
    );
    return result.rows[0];
  },

  async notifyFollowers(candidateId, { type, title, message, referenceType, referenceId }) {
    // Get all followers of this candidate with their email preferences
    const result = await db.query(
      `SELECT f.user_id, u.email, np.email_followed_post, np.email_followed_town_hall
       FROM follows f
       JOIN users u ON f.user_id = u.id
       LEFT JOIN notification_preferences np ON u.id = np.user_id
       WHERE f.candidate_id = $1 AND u.is_active = true`,
      [candidateId]
    );

    const notifications = [];
    for (const follower of result.rows) {
      // Create in-app notification
      const notif = await this.createNotification(follower.user_id, {
        type, title, message, referenceType, referenceId,
      });
      notifications.push(notif);

      // Send email if preferences allow
      try {
        const shouldEmail =
          (type === 'new_post' && follower.email_followed_post !== false) ||
          (type === 'new_town_hall' && follower.email_followed_town_hall !== false) ||
          (type === 'question_answered' && true);

        if (shouldEmail && follower.email) {
          await emailService.sendNotification(follower.email, title, message);
        }
      } catch (err) {
        console.error(`Failed to send email to ${follower.email}:`, err.message);
      }
    }

    return notifications;
  },

  async notifyQuestionAsker(questionId, candidateName) {
    const result = await db.query(
      `SELECT q.question_text, q.asked_by_user_id, u.email
       FROM questions q
       LEFT JOIN users u ON q.asked_by_user_id = u.id
       WHERE q.id = $1`,
      [questionId]
    );

    if (!result.rows[0] || !result.rows[0].asked_by_user_id) return;

    const { question_text, asked_by_user_id, email } = result.rows[0];

    await this.createNotification(asked_by_user_id, {
      type: 'question_answered',
      title: `${candidateName} answered your question`,
      message: `Your question "${question_text.slice(0, 100)}..." has been answered.`,
      referenceType: 'question',
      referenceId: questionId,
    });

    if (email) {
      try {
        await emailService.sendQuestionAnsweredNotification(email, candidateName, question_text);
      } catch (err) {
        console.error(`Failed to send answer notification email:`, err.message);
      }
    }
  },
};

module.exports = notificationService;
