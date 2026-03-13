import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Users, Calendar, CheckCircle, ArrowRight, ChevronRight } from 'lucide-react'
import api from '../utils/api'

function RaceDetailPage() {
  const { id } = useParams()
  const [race, setRace] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/races/${id}`).catch(() => null),
      api.get(`/candidates?raceId=${id}`).catch(() => ({ candidates: [] })),
    ])
      .then(([raceData, candidatesData]) => {
        if (!raceData) {
          setError('Race not found')
        } else {
          setRace(raceData.race || raceData)
          setCandidates(candidatesData.candidates || [])
        }
      })
      .catch(() => setError('Failed to load race details'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div className="loading-state">Loading race details...</div>
      </div>
    )
  }

  if (error || !race) {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div className="empty-state">
          <h3>{error || 'Race not found'}</h3>
          <Link to="/races" className="btn btn-primary" style={{ marginTop: '1rem' }}>
            Browse Races
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.875rem', opacity: 0.8 }}>
            <Link to="/races" style={{ color: 'inherit' }}>Races</Link>
            <ChevronRight size={14} />
            <span>{race.name}</span>
          </div>
          <h1>{race.name}</h1>
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {race.election_name && (
              <span className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', margin: 0 }}>
                <Calendar size={16} /> {race.election_name}
                {race.election_date && <> &mdash; {new Date(race.election_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</>}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {race.description && (
          <p style={{ color: 'var(--slate-600)', marginBottom: '2rem', maxWidth: '700px', lineHeight: 1.7 }}>
            {race.description}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ margin: 0 }}>
            <Users size={20} style={{ marginRight: '0.5rem', verticalAlign: 'text-bottom' }} />
            Candidates ({candidates.length})
          </h2>
          {candidates.length >= 2 && (
            <Link to={`/compare?race=${id}`} className="btn btn-primary">
              Compare Candidates <ArrowRight size={18} />
            </Link>
          )}
        </div>

        {candidates.length > 0 ? (
          <div className="candidate-grid">
            {candidates.map(candidate => {
              const name = candidate.display_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Candidate'
              return (
                <Link
                  to={`/candidate/${candidate.id}`}
                  key={candidate.id}
                  className="card candidate-card"
                >
                  <div className="candidate-card-top">
                    <div className="candidate-avatar">
                      {name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="candidate-info">
                      <h4 className="candidate-name">{name}</h4>
                      <div className="candidate-race">
                        {candidate.party_affiliation || candidate.official_title || ''}
                      </div>
                      <div className="candidate-badges">
                        {candidate.candidate_verified && (
                          <span className="badge badge-verified"><CheckCircle size={12} /> Verified</span>
                        )}
                        {candidate.is_incumbent && (
                          <span className="badge badge-incumbent">Incumbent</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="candidate-stats">
                    <div className="stat">
                      <div className="stat-value" style={{
                        color: (candidate.qa_response_rate || 0) >= 80 ? 'var(--success)' :
                               (candidate.qa_response_rate || 0) >= 50 ? 'var(--warning)' : 'var(--error)'
                      }}>
                        {candidate.qa_response_rate || 0}%
                      </div>
                      <div className="stat-label">Response Rate</div>
                    </div>
                    <div className="stat">
                      <div className="stat-value">{candidate.total_questions_answered || 0}</div>
                      <div className="stat-label">Q&A Answered</div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <h3>No candidates yet</h3>
            <p>No candidates have been added to this race yet. Check back soon.</p>
          </div>
        )}

        {(race.filing_deadline || race.seats_available) && (
          <div className="card" style={{ padding: '1.5rem', marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Race Details</h3>
            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
              {race.seats_available && (
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seats Available</div>
                  <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{race.seats_available}</div>
                </div>
              )}
              {race.filing_deadline && (
                <div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Filing Deadline</div>
                  <div style={{ fontWeight: 600, fontSize: '1.125rem' }}>{new Date(race.filing_deadline).toLocaleDateString()}</div>
                </div>
              )}
              {race.is_special_election && (
                <div>
                  <span className="badge" style={{ background: 'var(--warning)', color: 'white' }}>Special Election</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RaceDetailPage
