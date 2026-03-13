import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Menu, X, User, LogOut, ChevronDown, Shield, Bell, Search } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'


function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [showNotifications, setShowNotifications] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [showSearchDropdown, setShowSearchDropdown] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const searchRef = useRef(null)
  const mobileSearchRef = useRef(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      const data = await api.get('/users/notifications?limit=10', true)
      setNotifications(data.notifications || [])
      setUnreadCount((data.notifications || []).filter(n => !n.read_at).length)
    } catch {
      // silently fail
    }
  }, [user])

  // Initial fetch + polling every 60s, pausing when tab is hidden
  useEffect(() => {
    fetchNotifications()

    if (!user) return

    let intervalId = null

    const startPolling = () => {
      if (intervalId) return
      intervalId = setInterval(fetchNotifications, 60000)
    }

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchNotifications()
        startPolling()
      } else {
        stopPolling()
      }
    }

    if (document.visibilityState === 'visible') {
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchNotifications, user])

  // Close search dropdown on route change
  useEffect(() => {
    setShowSearchDropdown(false)
    setMobileSearchOpen(false)
    setSearchQuery('')
    setSearchResults(null)
  }, [location.pathname])

  // Debounced search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      setShowSearchDropdown(false)
      return
    }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const data = await api.get(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
        setSearchResults({
          candidates: (data.candidates || []).slice(0, 5),
          races: (data.races || []).slice(0, 3),
        })
        setShowSearchDropdown(true)
      } catch {
        setSearchResults(null)
      } finally {
        setSearchLoading(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Click outside to close search dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        searchRef.current && !searchRef.current.contains(e.target) &&
        (!mobileSearchRef.current || !mobileSearchRef.current.contains(e.target))
      ) {
        setShowSearchDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      setShowSearchDropdown(false)
      setMobileSearchOpen(false)
      navigate(`/explore?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const handleSearchResultClick = (path) => {
    setShowSearchDropdown(false)
    setSearchQuery('')
    setMobileSearchOpen(false)
    navigate(path)
  }

  const handleMarkAllRead = async () => {
    try {
      await api.post('/users/notifications/read-all', {}, true)
      setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
      setUnreadCount(0)
    } catch {
      // silently fail
    }
  }

  const handleNotificationClick = async (notification) => {
    if (!notification.read_at) {
      try {
        await api.post('/users/notifications/read', { notificationIds: [notification.id] }, true)
        setNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n))
        setUnreadCount(prev => Math.max(0, prev - 1))
      } catch {
        // silently fail
      }
    }
    if (notification.reference_url) {
      navigate(notification.reference_url)
    }
    setShowNotifications(false)
  }

  const timeAgo = (dateStr) => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const navLinks = [
    { path: '/explore', label: 'Find Candidates' },
    { path: '/races', label: 'Races' },
    { path: '/endorsements', label: 'Endorsements' },
    { path: '/town-halls', label: 'Town Halls' },
    ...(user ? [{ path: '/feed', label: 'Feed' }, { path: '/connections', label: 'Connections' }] : []),
    { path: '/how-it-works', label: 'How It Works' },
  ]

  const handleLogout = () => {
    logout()
    setUserMenuOpen(false)
    navigate('/')
  }

  const renderSearchDropdown = () => (
    <>
      {searchLoading && (
        <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.875rem' }}>
          Searching...
        </div>
      )}
      {!searchLoading && searchResults && (
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {(searchResults.candidates.length === 0 && searchResults.races.length === 0) ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.875rem' }}>
              No results found
            </div>
          ) : (
            <>
              {searchResults.candidates.length > 0 && (
                <div>
                  <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--slate-50)' }}>
                    Candidates
                  </div>
                  {searchResults.candidates.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSearchResultClick(`/candidate/${c.id}`)}
                      style={{
                        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                        padding: '0.625rem 1rem', background: 'white', fontFamily: 'var(--font-body)',
                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                        borderBottom: '1px solid var(--slate-100)',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'var(--navy-100, #e0e7ff)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy-700)', flexShrink: 0,
                      }}>
                        {(c.display_name || c.name || 'C').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-800)' }}>
                          {c.display_name || c.name}
                        </div>
                        {c.race_name && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {c.race_name}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {searchResults.races.length > 0 && (
                <div>
                  <div style={{ padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--slate-50)' }}>
                    Races
                  </div>
                  {searchResults.races.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handleSearchResultClick(`/races/${r.id}`)}
                      style={{
                        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                        padding: '0.625rem 1rem', background: 'white', fontFamily: 'var(--font-body)',
                        borderBottom: '1px solid var(--slate-100)',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--navy-800)' }}>{r.name}</div>
                      {r.state && <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>{r.state}</div>}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => handleSearchResultClick(`/explore?q=${encodeURIComponent(searchQuery.trim())}`)}
                style={{
                  width: '100%', textAlign: 'center', border: 'none', cursor: 'pointer',
                  padding: '0.75rem 1rem', background: 'var(--slate-50)', fontFamily: 'var(--font-body)',
                  color: 'var(--navy-600)', fontSize: '0.875rem', fontWeight: 600,
                }}
              >
                View all results for &ldquo;{searchQuery.trim()}&rdquo;
              </button>
            </>
          )}
        </div>
      )}
    </>
  )

  return (
    <header className="header">
      <div className="container header-inner">
        <Link to="/" className="logo">
          <div className="logo-mark">
            <span>WR</span>
          </div>
          <span>WhosRunning<span style={{ color: 'var(--burgundy-600)' }}>USA</span></span>
        </Link>

        {/* Desktop Search */}
        <div ref={searchRef} style={{ position: 'relative', flex: '0 1 320px', margin: '0 1.5rem' }} className="desktop-nav">
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none', zIndex: 1 }} />
          <input
            type="text"
            placeholder="Search candidates, races..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => { if (searchResults) setShowSearchDropdown(true) }}
            style={{
              width: '100%', padding: '0.5rem 0.75rem 0.5rem 2.25rem',
              border: '1px solid var(--slate-300)', borderRadius: '6px',
              fontSize: '0.875rem', fontFamily: 'var(--font-body)',
              background: 'var(--slate-50)', outline: 'none',
              transition: 'border-color 150ms ease, background 150ms ease',
            }}
          />
          {showSearchDropdown && (searchResults || searchLoading) && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: '0.25rem', background: 'white', borderRadius: '0.5rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              border: '1px solid var(--slate-200)', zIndex: 200, overflow: 'hidden',
            }}>
              {renderSearchDropdown()}
            </div>
          )}
        </div>

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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => { setShowNotifications(!showNotifications); setUserMenuOpen(false) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
                    padding: '0.5rem', display: 'flex', alignItems: 'center', color: 'var(--slate-600)'
                  }}
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span aria-live="polite" style={{
                      position: 'absolute', top: '2px', right: '2px',
                      background: 'var(--error)', color: '#fff', borderRadius: '50%',
                      width: unreadCount > 9 ? '18px' : '16px', height: '16px',
                      fontSize: '0.65rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1
                    }}>
                      <span className="sr-only">{unreadCount} unread notifications</span>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {showNotifications && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowNotifications(false)} />
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, zIndex: 100,
                      background: '#fff', borderRadius: '0.5rem', boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
                      border: '1px solid var(--slate-200)', width: '320px', maxHeight: '400px',
                      overflow: 'hidden', display: 'flex', flexDirection: 'column'
                    }}>
                      <div style={{
                        padding: '0.75rem 1rem', borderBottom: '1px solid var(--slate-200)',
                        fontWeight: 600, fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}>
                        <span>Notifications</span>
                        {unreadCount > 0 && (
                          <span style={{
                            background: 'var(--error)', color: '#fff', borderRadius: '10px',
                            padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 600
                          }}>
                            {unreadCount}
                          </span>
                        )}
                      </div>
                      <div style={{ overflowY: 'auto', flex: 1 }}>
                        {notifications.length === 0 ? (
                          <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--slate-400)', fontSize: '0.875rem' }}>
                            No notifications yet
                          </div>
                        ) : (
                          notifications.map(n => (
                            <button
                              key={n.id}
                              onClick={() => handleNotificationClick(n)}
                              style={{
                                width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                                padding: '0.75rem 1rem', borderBottom: '1px solid var(--slate-100)',
                                background: n.read_at ? '#fff' : 'var(--slate-50)',
                                fontFamily: 'var(--font-body)', display: 'block'
                              }}
                            >
                              <div style={{ fontSize: '0.8125rem', fontWeight: n.read_at ? 400 : 600, color: 'var(--slate-800)' }}>
                                {n.title}
                              </div>
                              {n.message && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                                  {n.message.length > 80 ? n.message.slice(0, 80) + '...' : n.message}
                                </div>
                              )}
                              <div style={{ fontSize: '0.6875rem', color: 'var(--slate-400)', marginTop: '0.25rem' }}>
                                {timeAgo(n.created_at)}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                      {notifications.length > 0 && unreadCount > 0 && (
                        <button
                          onClick={handleMarkAllRead}
                          style={{
                            width: '100%', padding: '0.625rem', border: 'none',
                            borderTop: '1px solid var(--slate-200)', background: '#fff',
                            color: 'var(--navy-600)', fontSize: '0.8125rem', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'var(--font-body)'
                          }}
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={() => { setUserMenuOpen(!userMenuOpen); setShowNotifications(false) }}
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
                        <Link to="/dashboard" className="user-dropdown-item" onClick={() => setUserMenuOpen(false)}>
                          Dashboard
                        </Link>
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

        {/* Mobile: search icon + menu button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button
            className="mobile-menu-btn"
            onClick={() => { setMobileSearchOpen(!mobileSearchOpen); setMobileMenuOpen(false) }}
            aria-label="Toggle search"
          >
            <Search size={22} />
          </button>
          <button
            className="mobile-menu-btn"
            onClick={() => { setMobileMenuOpen(!mobileMenuOpen); setMobileSearchOpen(false) }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {mobileSearchOpen && (
        <div ref={mobileSearchRef} style={{
          padding: '0.75rem var(--container-padding)',
          background: 'white', borderTop: '1px solid var(--slate-200)',
          position: 'relative',
        }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Search candidates, races..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoFocus
              style={{
                width: '100%', padding: '0.625rem 0.75rem 0.625rem 2.25rem',
                border: '1px solid var(--slate-300)', borderRadius: '6px',
                fontSize: '0.9375rem', fontFamily: 'var(--font-body)',
              }}
            />
          </div>
          {showSearchDropdown && (searchResults || searchLoading) && (
            <div style={{
              marginTop: '0.25rem', background: 'white', borderRadius: '0.5rem',
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
              border: '1px solid var(--slate-200)', overflow: 'hidden',
            }}>
              {renderSearchDropdown()}
            </div>
          )}
        </div>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="mobile-menu">
          <nav className="mobile-nav">
            <Link
              to="/"
              className={`mobile-nav-link ${location.pathname === '/' ? 'active' : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Home
            </Link>
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
                <button
                  className="btn btn-secondary"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    setShowNotifications(!showNotifications)
                  }}
                >
                  <Bell size={16} />
                  Notifications
                  {unreadCount > 0 && (
                    <span style={{
                      background: 'var(--error)', color: '#fff', borderRadius: '999px',
                      padding: '0.1rem 0.5rem', fontSize: '0.7rem', fontWeight: 600,
                      marginLeft: 'auto'
                    }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                {user.user_type === 'candidate' && (
                  <Link to="/dashboard" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setMobileMenuOpen(false)}>
                    Dashboard
                  </Link>
                )}
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
