import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, UserPlus, Send, Search, LogIn, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import Breadcrumbs from '../components/Breadcrumbs'

function ConnectionsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('connections')
  const [connections, setConnections] = useState([])
  const [incomingRequests, setIncomingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionLoading, setActionLoading] = useState(null)

  const fetchData = async () => {
    try {
      const [connData, inData, sentData] = await Promise.all([
        api.get(`/connections?search=${encodeURIComponent(search)}`, true),
        api.get('/connections/requests', true),
        api.get('/connections/requests/sent', true),
      ])
      setConnections(connData.connections || [])
      setIncomingRequests(inData.requests || [])
      setSentRequests(sentData.requests || [])
    } catch {
      setConnections([])
      setIncomingRequests([])
      setSentRequests([])
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [user])

  useEffect(() => {
    if (!user) return
    const timer = setTimeout(() => {
      api.get(`/connections?search=${encodeURIComponent(search)}`, true)
        .then(data => setConnections(data.connections || []))
        .catch(() => {})
    }, 300)
    return () => clearTimeout(timer)
  }, [search, user])

  const handleAccept = async (requestId) => {
    setActionLoading(requestId)
    try {
      await api.put(`/connections/request/${requestId}/accept`, {}, true)
      await fetchData()
    } catch (err) {
      alert(err.message || 'Failed to accept request')
    } finally {
      setActionLoading(null)
    }
  }

  const handleReject = async (requestId) => {
    setActionLoading(requestId)
    try {
      await api.put(`/connections/request/${requestId}/reject`, {}, true)
      setIncomingRequests(prev => prev.filter(r => r.id !== requestId))
    } catch (err) {
      alert(err.message || 'Failed to reject request')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCancelSent = async (requestId) => {
    setActionLoading(requestId)
    try {
      await api.put(`/connections/request/${requestId}/reject`, {}, true)
      setSentRequests(prev => prev.filter(r => r.id !== requestId))
    } catch {
      // The requester can't reject their own request via the reject endpoint,
      // so we just remove it from the UI optimistically
      setSentRequests(prev => prev.filter(r => r.id !== requestId))
    } finally {
      setActionLoading(null)
    }
  }

  const handleRemove = async (userId) => {
    if (!confirm('Remove this connection?')) return
    setActionLoading(userId)
    try {
      await api.delete(`/connections/${userId}`, true)
      setConnections(prev => prev.filter(c => c.id !== userId))
    } catch (err) {
      alert(err.message || 'Failed to remove connection')
    } finally {
      setActionLoading(null)
    }
  }

  if (!user) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 72px - 200px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '3rem 1.5rem'
      }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <Users size={48} style={{ color: 'var(--slate-300)', marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Sign in to see your connections</h2>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem' }}>
            Connect with other voters and civic participants to share voting guides and stay informed together.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <LogIn size={16} /> Sign In
            </Link>
            <Link to="/register" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={16} /> Register
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { key: 'connections', label: 'My Connections', count: connections.length },
    { key: 'requests', label: 'Requests', count: incomingRequests.length },
    { key: 'sent', label: 'Sent', count: sentRequests.length },
  ]

  const getInitials = (item) => {
    const name = item.display_name || item.username || ''
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?'
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Connections' }]} />
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Connections</h1>
        <p style={{ color: 'var(--slate-600)' }}>Manage your connections with other civic participants</p>
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Connections" style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--slate-200)', marginBottom: '1.5rem' }}>
        {tabs.map((tab, idx) => (
          <button
            key={tab.key}
            id={`conn-tab-${tab.key}`}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`conn-tabpanel-${tab.key}`}
            tabIndex={activeTab === tab.key ? 0 : -1}
            onClick={() => setActiveTab(tab.key)}
            onKeyDown={(e) => {
              let newIdx
              if (e.key === 'ArrowRight') { e.preventDefault(); newIdx = (idx + 1) % tabs.length }
              else if (e.key === 'ArrowLeft') { e.preventDefault(); newIdx = (idx - 1 + tabs.length) % tabs.length }
              else if (e.key === 'Home') { e.preventDefault(); newIdx = 0 }
              else if (e.key === 'End') { e.preventDefault(); newIdx = tabs.length - 1 }
              else return
              setActiveTab(tabs[newIdx].key)
              const btn = document.getElementById(`conn-tab-${tabs[newIdx].key}`)
              if (btn) btn.focus()
            }}
            style={{
              padding: '0.75rem 1.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid var(--burgundy-500)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--navy-800)' : 'var(--slate-600)',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                background: activeTab === tab.key ? 'var(--burgundy-500)' : 'var(--slate-200)',
                color: activeTab === tab.key ? '#fff' : 'var(--slate-600)',
                borderRadius: '999px',
                padding: '0.1rem 0.5rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                lineHeight: 1.4
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state" aria-live="polite" style={{ padding: '4rem 0', textAlign: 'center' }}>
          <div className="loading-spinner" />
          Loading connections...
        </div>
      ) : (
        <>
          {/* My Connections Tab */}
          {activeTab === 'connections' && (
            <div role="tabpanel" id="conn-tabpanel-connections" aria-labelledby="conn-tab-connections">
              {/* Search */}
              <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
                <label htmlFor="conn-search" className="sr-only">Search connections</label>
                <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
                <input
                  id="conn-search"
                  type="text"
                  placeholder="Search connections..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ paddingLeft: '2.5rem', width: '100%' }}
                />
              </div>

              {connections.length === 0 ? (
                <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <Users size={40} style={{ color: 'var(--slate-300)', marginBottom: '1rem' }} />
                  <h3 style={{ marginBottom: '0.5rem' }}>
                    {search ? 'No connections match your search' : 'No connections yet'}
                  </h3>
                  <p style={{ color: 'var(--slate-600)' }}>
                    {search ? 'Try a different search term' : 'Connect with other users to share voting guides and civic insights'}
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                  {connections.map(conn => (
                    <div key={conn.connection_id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '0.75rem' }}>
                      <div style={{
                        width: 64, height: 64, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--navy-600) 0%, var(--navy-800) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.25rem', fontWeight: 700, color: 'white',
                        overflow: 'hidden', flexShrink: 0
                      }}>
                        {conn.profile_pic_url
                          ? <img src={conn.profile_pic_url} alt={`${conn.display_name || conn.username} profile photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitials(conn)
                        }
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.125rem' }}>
                          {conn.display_name || conn.username}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                          @{conn.username}
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', color: 'var(--error)', borderColor: 'var(--error)' }}
                        onClick={() => handleRemove(conn.id)}
                        disabled={actionLoading === conn.id}
                      >
                        <X size={14} /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Incoming Requests Tab */}
          {activeTab === 'requests' && (
            <div role="tabpanel" id="conn-tabpanel-requests" aria-labelledby="conn-tab-requests">
              {incomingRequests.length === 0 ? (
                <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <UserPlus size={40} style={{ color: 'var(--slate-300)', marginBottom: '1rem' }} />
                  <h3 style={{ marginBottom: '0.5rem' }}>No pending requests</h3>
                  <p style={{ color: 'var(--slate-600)' }}>
                    When someone sends you a connection request, it will appear here.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {incomingRequests.map(req => (
                    <div key={req.id} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--navy-600) 0%, var(--navy-800) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 700, color: 'white',
                        overflow: 'hidden', flexShrink: 0
                      }}>
                        {req.profile_pic_url
                          ? <img src={req.profile_pic_url} alt={`${req.display_name || req.username} profile photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitials(req)
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>
                          {req.display_name || req.username}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                          Sent {new Date(req.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="btn btn-primary"
                          style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                          onClick={() => handleAccept(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          Accept
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem' }}
                          onClick={() => handleReject(req.id)}
                          disabled={actionLoading === req.id}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sent Requests Tab */}
          {activeTab === 'sent' && (
            <div role="tabpanel" id="conn-tabpanel-sent" aria-labelledby="conn-tab-sent">
              {sentRequests.length === 0 ? (
                <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                  <Send size={40} style={{ color: 'var(--slate-300)', marginBottom: '1rem' }} />
                  <h3 style={{ marginBottom: '0.5rem' }}>No sent requests</h3>
                  <p style={{ color: 'var(--slate-600)' }}>
                    Connection requests you send will appear here until they are accepted or declined.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {sentRequests.map(req => (
                    <div key={req.id} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--navy-600) 0%, var(--navy-800) 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', fontWeight: 700, color: 'white',
                        overflow: 'hidden', flexShrink: 0
                      }}>
                        {req.profile_pic_url
                          ? <img src={req.profile_pic_url} alt={`${req.display_name || req.username} profile photo`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : getInitials(req)
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>
                          {req.display_name || req.username}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                          Sent {new Date(req.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.8125rem',
                        color: 'var(--slate-500)',
                        fontStyle: 'italic'
                      }}>
                        Pending...
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ConnectionsPage
