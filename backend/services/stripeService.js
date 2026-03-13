const Stripe = require('stripe');

let stripe = null;

function getStripe() {
  if (!stripe && process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

async function createVerificationSession(candidateId, returnUrl) {
  const client = getStripe();
  if (!client) {
    throw new Error('Stripe is not configured');
  }

  const session = await client.identity.verificationSessions.create({
    type: 'document',
    metadata: { candidateId },
    options: {
      document: {
        require_matching_selfie: true,
      },
    },
    return_url: returnUrl,
  });

  return session;
}

async function getVerificationSession(sessionId) {
  const client = getStripe();
  if (!client) {
    throw new Error('Stripe is not configured');
  }
  return client.identity.verificationSessions.retrieve(sessionId);
}

module.exports = {
  createVerificationSession,
  getVerificationSession,
};
