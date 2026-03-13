function PrivacyPage() {
  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Privacy Policy</h1>
          <p className="page-subtitle">Last updated: March 2026</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <div className="legal-content">
          <section>
            <h2>1. Information We Collect</h2>
            <h3>Account Information</h3>
            <p>When you create an account, we collect your name, email address, password (stored securely using bcrypt hashing), and location (city, state, zip code). For candidate accounts, we also collect your party affiliation, campaign information, and official title.</p>

            <h3>Usage Information</h3>
            <p>We collect information about how you interact with the platform, including pages visited, candidates followed, questions asked, and voting guide selections. This helps us improve the platform and show you relevant content.</p>

            <h3>Location Data</h3>
            <p>We use your location to show you relevant races, candidates, and elections in your area. We do not track your precise GPS location. You provide your city and state during registration.</p>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>To show you relevant candidates and races based on your location</li>
              <li>To enable Q&A between voters and candidates</li>
              <li>To send election reminders and notification updates</li>
              <li>To maintain platform security and prevent abuse</li>
              <li>To improve the platform based on usage patterns</li>
            </ul>
          </section>

          <section>
            <h2>3. What We Share</h2>
            <p><strong>Public information:</strong> Your username and questions you ask are publicly visible. For candidates, your profile, positions, Q&A responses, and engagement metrics are public by design.</p>
            <p><strong>We do not sell your personal information.</strong> We do not share your email, location, or account details with third parties for marketing purposes.</p>
          </section>

          <section>
            <h2>4. Data Security</h2>
            <p>Passwords are hashed using bcrypt. We use JWT tokens for authentication with configurable expiration. All API traffic is encrypted via HTTPS. We employ rate limiting and security headers (via Helmet) to protect against common attacks.</p>
          </section>

          <section>
            <h2>5. Your Rights</h2>
            <ul>
              <li><strong>Access:</strong> You can view all data associated with your account at any time.</li>
              <li><strong>Correction:</strong> You can update your profile information at any time.</li>
              <li><strong>Deletion:</strong> You can request deletion of your account by contacting support.</li>
              <li><strong>Notifications:</strong> You can customize which email notifications you receive.</li>
            </ul>
          </section>

          <section>
            <h2>6. Cookies</h2>
            <p>We use minimal cookies for authentication (JWT token storage) and basic analytics. We do not use third-party advertising cookies or trackers.</p>
          </section>

          <section>
            <h2>7. Contact</h2>
            <p>For privacy-related questions, contact us at privacy@whosrunningusa.com.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default PrivacyPage
