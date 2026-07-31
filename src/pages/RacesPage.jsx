import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Calendar, MapPin, Users, ChevronRight, ChevronDown, Search, X, Loader, ArrowRight, Vote } from 'lucide-react'
import api from '../utils/api'
import { formatDate } from '../utils/dateFormat'
import { SkeletonCard } from '../components/Skeleton'
import useDebounce from '../hooks/useDebounce'

const scopeLevels = [
  { value: 'all', label: 'All Levels' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'county', label: 'County' },
  { value: 'city', label: 'City/Local' },
]

function RacesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [races, setRaces] = useState([])
  const [elections, setElections] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [scopeFilter, setScopeFilter] = useState(searchParams.get('scope') || 'all')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 40

  const debouncedSearch = useDebounce(searchQuery, 300)

  // Sync URL params
  useEffect(() => {
    const next = new URLSearchParams()
    if (scopeFilter !== 'all') next.set('scope', scopeFilter)
    if (debouncedSearch) next.set('q', debouncedSearch)
    setSearchParams(next, { replace: true })
  }, [scopeFilter, debouncedSearch, setSearchParams])

  useEffect(() => {
    setLoading(true)
    setSearching(true)
    const params = new URLSearchParams()
    if (scopeFilter !== 'all') params.set('scope', scopeFilter)
    if (debouncedSearch) params.set('q', debouncedSearch)
    params.set('upcoming', 'true')
    params.set('limit', String(PAGE_SIZE))
    Promise.all([
      api.get(`/races?${params.toString()}`).catch(() => ({ races: [] })),
      api.get('/elections?upcoming=true').catch(() => ({ elections: [] })),
    ])
      .then(([racesData, electionsData]) => {
        const results = racesData.races || []
        setRaces(results)
        setHasMore(results.length >= PAGE_SIZE)
        setElections(electionsData.elections || [])
      })
      .catch(() => setError('Failed to load races'))
      .finally(() => { setLoading(false); setSearching(false) })
  }, [scopeFilter, debouncedSearch])

  const loadMore = () => {
    setLoadingMore(true)
    const params = new URLSearchParams()
    if (scopeFilter !== 'all') params.set('scope', scopeFilter)
    if (debouncedSearch) params.set('q', debouncedSearch)
    params.set('upcoming', 'true')
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
          <div style={{ flex: 1, minWidth: '220px', maxWidth: '400px', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
            <input
              type="text"
              placeholder="Search races..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '2.5rem', paddingRight: searchQuery ? '4rem' : '1rem', width: '100%' }}
            />
            <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {searching && searchQuery && (
                <Loader size={16} style={{ color: 'var(--slate-400)', animation: 'spin 1s linear infinite' }} />
              )}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', color: 'var(--slate-400)', display: 'flex', alignItems: 'center' }}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

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

        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} height={100} />
            ))}
          </div>
        )}
        {error && <div className="error-state">{error}</div>}

        {!loading && elections.length > 0 && (() => {
          const now = new Date()
          const upcoming = elections.filter(el => {
            if (!el.election_date) return true
            return new Date(el.election_date) >= now
          })
          if (upcoming.length === 0) return null
          return (
            <div style={{ marginBottom: '2.5rem' }}>
              <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Upcoming Elections</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                {upcoming.map(election => {
                  const d = election.election_date ? new Date(election.election_date) : null
                  const daysAway = d ? Math.ceil((d - now) / (1000 * 60 * 60 * 24)) : null
                  const isToday = daysAway === 0
                  return (
                    <div key={election.id} className="card" style={{
                      padding: '1.75rem 1.5rem',
                      background: 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-900) 100%)',
                      color: 'white',
                      borderLeft: daysAway != null && daysAway <= 60 ? '4px solid var(--burgundy-500)' : '4px solid transparent',
                    }}>
                      <h3 style={{ margin: 0, fontSize: '1.375rem', color: 'white' }}>{election.name}</h3>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.75rem', fontSize: '0.9375rem', color: 'rgba(255,255,255,0.85)' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                          <Calendar size={16} /> {formatDate(election.election_date)}
                        </span>
                        {daysAway != null && (
                          <span style={{ fontWeight: 700, color: daysAway <= 60 ? '#f59e0b' : '#ffffff' }}>
                            {isToday ? 'Today' : daysAway === 1 ? 'Tomorrow' : `${daysAway} days away`}
                          </span>
                        )}
                        {election.state && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                            <MapPin size={14} /> {election.state}
                          </span>
                        )}
                      </div>
                      {election.registration_deadline && (
                        <p style={{ fontSize: '0.8125rem', color: '#fde68a', marginTop: '0.75rem', marginBottom: 0 }}>
                          Registration deadline: {formatDate(election.registration_deadline)}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

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
            <Vote size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
            <h3>No races match your filters</h3>
            <p style={{ maxWidth: 480, margin: '0 auto 1rem' }}>
              We&apos;re actively adding new races for the upcoming election cycle. Try broadening your filters, or browse candidates directly while we catch up.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Link to="/explore" className="btn btn-primary">Browse Candidates <ArrowRight size={18} /></Link>
              <Link to="/find-my-ballot" className="btn btn-secondary">Find My Ballot</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default RacesPage
