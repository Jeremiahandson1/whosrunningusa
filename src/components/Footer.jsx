import { Link } from 'react-router-dom'

function Footer() {
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
        
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} WhosRunningUSA. All rights reserved.</p>
          <p style={{ color: 'var(--slate-500)' }}>
            Every race. Every candidate. No hiding.
          </p>
        </div>
      </div>
    </footer>
  )
}

export default Footer
