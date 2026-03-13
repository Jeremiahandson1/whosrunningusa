import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut, ChevronDown, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const navLinks = [
    { path: '/explore', label: 'Find Candidates' },
    { path: '/races', label: 'Races' },
    { path: '/town-halls', label: 'Town Halls' },
    { path: '/how-it-works', label: 'How It Works' },
  ]

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    navigate('/')
  }

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <div className="logo-mark">
            <span>WR</span>
          </div>
          <span>WhosRunning<span style={{ color: 'var(--burgundy-600)' }}>USA</span></span>
        </Link>

        <nav className="nav desktop-nav">
          {navLinks.map(link => (
            <Link
              key={link.path}
              to={link.path}
              className={`nav-link ${location.pathname === link.path ? 'active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="nav-actions desktop-nav">
          {user ? (
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <User size={16} />
                {user.first_name || user.username || 'Account'}
                <ChevronDown size={14} />
              </button>
              {userMenuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setUserMenuOpen(false)} />
                  <div className="user-dropdown">
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--slate-200)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{user.first_name || ''} {user.last_name || ''}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{user.email}</div>
                    </div>
                    {user.user_type === 'candidate' && (
                      <>
                        <Link to={`/candidate/${user.candidate_profile_id || 'me'}`} className="user-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                          My Profile
                        </Link>
                        <Link to="/candidate/edit" className="user-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                          Edit Profile
                        </Link>
                      </>
                    )}
                    <Link to="/voting-guide" className="user-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                      Voting Guide
                    </Link>
                    {user.user_type === 'admin' && (
                      <Link to="/admin" className="user-dropdown-item" onClick={() => setUserMenuOpen(false)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={14} /> Admin Panel
                      </Link>
                    )}
                    <button className="user-dropdown-item" onClick={handleLogout} style={{ width: '100%', textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)' }}>
                      <LogOut size={14} /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>
                Sign In
              </Link>
              <Link to="/register" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }}>
                Get Started
              </Link>
            </>
          )}
        </div>

        <button
          className="mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav">
            {navLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`mobile-nav-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mobile-menu-actions">
            {user ? (
              <>
                <div style={{ padding: '0.75rem 0', fontWeight: 600, fontSize: '0.875rem' }}>
                  {user.first_name || ''} {user.last_name || ''}
                </div>
                <Link to="/voting-guide" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setMobileMenuOpen(false)}>
                  Voting Guide
                </Link>
                {user.user_type === 'admin' && (
                  <Link to="/admin" className="btn btn-secondary" style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setMobileMenuOpen(false)}>
                    <Shield size={16} /> Admin Panel
                  </Link>
                )}
                <button className="btn btn-secondary" style={{ width: '100%', color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => { handleLogout(); setMobileMenuOpen(false) }}>
                  <LogOut size={16} /> Sign Out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setMobileMenuOpen(false)}>
                  Sign In
                </Link>
                <Link to="/register" className="btn btn-primary" style={{ width: '100%' }} onClick={() => setMobileMenuOpen(false)}>
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
