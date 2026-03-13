import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, Clock, Users, PlayCircle, MessageCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { formatDate, formatDateTime } from '../utils/dateFormat'

function TownHallsPage() {
  const { user } = useAuth()
  const [townHalls, setTownHalls] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/town-halls/upcoming')
      .then(data => setTownHalls(data.townHalls || []))
      .catch(() => setTownHalls([]))
      .finally(() => setLoading(false))
  }, [])

  const handleRsvp = async (townHallId) => {
    if (!user) return alert('Please sign in to RSVP')
    try {
      await api.post(`/town-halls/${townHallId}/rsvp`, {}, true)
      alert('RSVP confirmed!')
    } catch (err) {
      alert(err.message || 'Failed to RSVP')
    }
  }

  const formatTime = (dateStr) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Town Halls</h1>
          <p className="page-subtitle">
            Attend live video or text-based Q&A sessions with candidates. Ask questions directly and hear their answers in real time.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {loading && <div className="loading-state">Loading upcoming town halls...</div>}

        {!loading && townHalls.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {townHalls.map(th => (
              <div key={th.id} className="card" style={{ padding: '1.5rem', borderLeft: `3px solid ${th.format === 'video' ? 'var(--burgundy-500)' : 'var(--navy-600)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <span className="badge badge-candidate" style={{ marginBottom: '0.5rem' }}>
                      {th.format === 'video' ? 'Video Town Hall' : 'Text-Based AMA'}
                    </span>
                    <h3 style={{ marginBottom: '0.5rem' }}>{th.title}</h3>
                    {th.candidate_name && (
                      <p style={{ fontSize: '0.9375rem', color: 'var(--slate-600)', marginBottom: '0.75rem' }}>
                        Hosted by <Link to={`/candidate/${th.candidate_id}`} style={{ fontWeight: 600 }}>{th.candidate_name}</Link>
                      </p>
                    )}
                    {th.description && (
                      <p style={{ color: 'var(--slate-700)', marginBottom: '0.75rem' }}>{th.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9375rem', color: 'var(--slate-600)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Calendar size={16} /> {formatDate(th.scheduled_at)}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        <Clock size={16} /> {formatTime(th.scheduled_at)}
                      </span>
                      {th.attendee_count !== undefined && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Users size={16} /> {th.attendee_count} attending
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="btn btn-primary" onClick={() => handleRsvp(th.id)}>
                    {th.format === 'video' ? <><PlayCircle size={18} /> RSVP</> : <><MessageCircle size={18} /> Join</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && townHalls.length === 0 && (
          <div className="empty-state">
            <PlayCircle size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
            <h3>No upcoming town halls</h3>
            <p>Check back soon. Candidates schedule town halls regularly to engage with voters.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default TownHallsPage
