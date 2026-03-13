import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import api from '../utils/api'

function Footer() {
  const [email, setEmail] = useState('')
  const [newsletterStatus, setNewsletterStatus] = useState(null) // null | 'loading' | 'success' | 'error'
  const [newsletterError, setNewsletterError] = useState('')

  const handleNewsletterSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setNewsletterStatus('loading')
    setNewsletterError('')
    try {
      await api.post('/contact/newsletter', { email: email.trim() })
      setNewsletterStatus('success')
      setEmail('')
    } catch (err) {
      setNewsletterStatus('error')
      setNewsletterError(err.message || 'Failed to subscribe. Please try again.')
    }
  }

  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">WhosRunningUSA</div>
            <p className="footer-tagline">"Earn Our Vote"</p>
            <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
              Democracy works better when candidates have to earn our votes through
              transparency, engagement, and accountability.
            </p>
          </div>

          <div>
            <div className="footer-title">For Voters</div>
            <ul className="footer-links">
              <li><Link to="/explore">Find Candidates</Link></li>
              <li><Link to="/races">Browse Races</Link></li>
              <li><Link to="/compare">Compare Candidates</Link></li>
              <li><Link to="/voting-guide">Build Voting Guide</Link></li>
              <li><Link to="/register">Create Account</Link></li>
            </ul>
          </div>

          <div>
            <div className="footer-title">For Candidates</div>
            <ul className="footer-links">
              <li><Link to="/run">Run For Office</Link></li>
              <li><Link to="/candidate-features">Platform Features</Link></li>
              <li><Link to="/town-halls">Host Town Halls</Link></li>
              <li><Link to="/faq-candidates">Candidate FAQ</Link></li>
            </ul>
          </div>

          <div>
            <div className="footer-title">Company</div>
            <ul className="footer-links">
              <li><Link to="/about">About Us</Link></li>
              <li><Link to="/mission">Our Mission</Link></li>
              <li><Link to="/contact">Contact</Link></li>
              <li><Link to="/privacy">Privacy Policy</Link></li>
              <li><Link to="/terms">Terms of Service</Link></li>
            </ul>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '2rem', paddingTop: '2rem' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <Mail size={18} />
              <span style={{ fontWeight: 600, fontSize: '1rem' }}>Stay Informed</span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--slate-400)', marginBottom: '1rem' }}>
              Get election updates and new race alerts delivered to your inbox.
            </p>
            {newsletterStatus === 'success' ? (
              <div style={{ color: 'var(--success, #22c55e)', fontWeight: 600, fontSize: '0.9375rem', padding: '0.5rem' }}>
                You're subscribed!
              </div>
            ) : (
              <form onSubmit={handleNewsletterSubmit} style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  style={{
                    flex: 1,
                    maxWidth: '300px',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)',
                    color: 'inherit',
                    fontSize: '0.875rem',
                  }}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', flexShrink: 0 }}
                  disabled={newsletterStatus === 'loading'}
                >
                  {newsletterStatus === 'loading' ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            )}
            {newsletterStatus === 'error' && (
              <div style={{ color: 'var(--error, #ef4444)', fontSize: '0.8125rem', marginTop: '0.5rem' }}>
                {newsletterError}
              </div>
            )}
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} WhosRunningUSA. All rights reserved.</p>
          <p style={{ color: 'var(--slate-500)' }}>
            Every race. Every candidate. No hiding.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
