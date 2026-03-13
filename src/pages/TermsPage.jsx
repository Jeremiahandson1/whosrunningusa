function TermsPage() {
  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Terms of Service</h1>
          <p className="page-subtitle">Last updated: March 2026</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        <div className="legal-content">
          <section>
            <h2>1. Acceptance of Terms</h2>
            <p>By creating an account or using WhosRunningUSA, you agree to these terms. If you do not agree, please do not use the platform.</p>
          </section>

          <section>
            <h2>2. Account Types</h2>
            <h3>Voter Accounts</h3>
            <p>Voter accounts are free and allow you to browse candidates, ask questions, upvote questions, attend town halls, and build voting guides. You must use a valid email address and your username will be publicly visible alongside your questions.</p>

            <h3>Candidate Accounts</h3>
            <p>Candidate accounts are free and provide tools to create a campaign profile, declare issue positions, answer voter questions, host town halls, and track campaign promises. Candidates may complete identity verification to earn a verified badge.</p>
          </section>

          <section>
            <h2>3. Content Guidelines</h2>
            <ul>
              <li><strong>Public discourse:</strong> All Q&A and candidate communication on the platform is public.</li>
              <li><strong>No private messaging:</strong> The platform does not support private messages to maintain transparency.</li>
              <li><strong>No external links:</strong> Candidate profiles may not include clickable external links.</li>
              <li><strong>No harassment:</strong> Personal attacks, threats, hate speech, and spam are prohibited.</li>
              <li><strong>Accurate information:</strong> Candidates must provide truthful information about their positions and qualifications.</li>
            </ul>
          </section>

          <section>
            <h2>4. Endorsements</h2>
            <p>Only verified candidates may endorse other candidates. Organizational endorsements (PACs, parties, unions, etc.) are not permitted on the platform. This policy ensures endorsements reflect genuine peer-to-peer support.</p>
          </section>

          <section>
            <h2>5. Moderation</h2>
            <p>We use a combination of community flagging and review to moderate content. Users can flag questions, answers, or posts that violate our guidelines. Community notes may be added to provide context on disputed claims.</p>
          </section>

          <section>
            <h2>6. Data and Privacy</h2>
            <p>Your use of the platform is also governed by our <a href="/privacy">Privacy Policy</a>. Engagement metrics for candidates (response rate, questions answered, pending questions) are publicly visible by design.</p>
          </section>

          <section>
            <h2>7. Limitation of Liability</h2>
            <p>WhosRunningUSA provides information to help voters make informed decisions. We do not guarantee the accuracy of candidate-provided information. We are not responsible for the content posted by candidates or voters on the platform.</p>
          </section>

          <section>
            <h2>8. Changes to Terms</h2>
            <p>We may update these terms from time to time. We will notify registered users of significant changes via email. Continued use of the platform after changes constitutes acceptance.</p>
          </section>

          <section>
            <h2>9. Contact</h2>
            <p>Questions about these terms? Contact us at legal@whosrunningusa.com.</p>
          </section>
        </div>
      </div>
    </div>
  )
}

export default TermsPage
