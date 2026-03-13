import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, MapPin, Users, ChevronRight, ChevronDown } from 'lucide-react'
import api from '../utils/api'

const scopeLevels = [
  { value: 'all', label: 'All Levels' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'county', label: 'County' },
  { value: 'city', label: 'City/Local' },
]

function RacesPage() {
  const [races, setRaces] = useState([])
  const [elections, setElections] = useState([])
  const [loading, setLoading] = useState(true)
  const [scopeFilter, setScopeFilter] = useState('all')
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 40

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (scopeFilter !== 'all') params.set('scope', scopeFilter)
    params.set('limit', String(PAGE_SIZE))
    Promise.all([
      api.get(`/races?${params.toString()}`).catch(() => ({ races: [] })),
      api.get('/elections').catch(() => ({ elections: [] })),
    ])
      .then(([racesData, electionsData]) => {
        const results = racesData.races || []
        setRaces(results)
        setHasMore(results.length >= PAGE_SIZE)
        setElections(electionsData.elections || [])
      })
      .catch(() => setError('Failed to load races'))
      .finally(() => setLoading(false))
  }, [scopeFilter])

  const loadMore = () => {
    setLoadingMore(true)
    const params = new URLSearchParams()
    if (scopeFilter !== 'all') params.set('scope', scopeFilter)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String(races.length))
    api.get(`/races?${params.toString()}`)
      .then(data => {
        const results = data.races || []
        setRaces(prev => [...prev, ...results])
        setHasMore(results.length >= PAGE_SIZE)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Browse Races</h1>
          <p className="page-subtitle">
            See every race on your ballot, from President to School Board.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem' }}>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative' }}>
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value)}
              style={{ appearance: 'none', paddingRight: '2.5rem', minWidth: '150px', cursor: 'pointer' }}
            >
              {scopeLevels.map(level => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
            <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--slate-500)' }} />
          </div>
        </div>

        {loading && <div className="loading-state">Loading races...</div>}
        {error && <div className="error-state">{error}</div>}

        {!loading && elections.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Upcoming Elections</h2>
            <div className="feed-grid">
              {elections.map(election => (
                <div key={election.id} className="card" style={{ padding: '1.5rem' }}>
                  <h4 style={{ marginBottom: '0.5rem' }}>{election.name}</h4>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Calendar size={14} /> {new Date(election.election_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    {election.state && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <MapPin size={14} /> {election.state}
                      </span>
                    )}
                  </div>
                  {election.registration_deadline && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--warning)', marginTop: '0.5rem', marginBottom: 0 }}>
                      Registration deadline: {new Date(election.registration_deadline).toLocaleDateString()}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && races.length > 0 && (
          <div>
            <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
              {races.length} Race{races.length !== 1 ? 's' : ''}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
              {races.map(race => (
                <Link to={`/races/${race.id}`} key={race.id} className="card" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h4 style={{ marginBottom: '0.25rem' }}>{race.name}</h4>
                    {race.election_name && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--slate-600)', margin: 0 }}>{race.election_name}</p>
                    )}
                    {race.candidate_count !== undefined && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem', color: 'var(--navy-600)', marginTop: '0.5rem' }}>
                        <Users size={14} /> {race.candidate_count} candidate{race.candidate_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <ChevronRight size={20} style={{ color: 'var(--slate-400)' }} />
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && hasMore && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore} style={{ padding: '0.75rem 2rem' }}>
              {loadingMore ? 'Loading...' : 'Load More Races'}
            </button>
          </div>
        )}

        {!loading && races.length === 0 && !error && (
          <div className="empty-state">
            <h3>No races found</h3>
            <p>Check back soon as we add more races to the database, or try a different filter.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default RacesPage
