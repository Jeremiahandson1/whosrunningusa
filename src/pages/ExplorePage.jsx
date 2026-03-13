import React, { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, Filter, ChevronDown, CheckCircle,
  Grid, List, X
} from 'lucide-react'
import api from '../utils/api'
import USMap from '../components/USMap'

const levels = [
  { value: 'all', label: 'All Levels' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'county', label: 'County' },
  { value: 'local', label: 'Local' },
]

const issueFilters = [
  'Economy', 'Education', 'Healthcare', 'Environment', 'Public Safety',
  'Immigration', 'Housing', 'Infrastructure', 'Civil Rights'
]

const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'
}

function ExplorePage() {
  const [searchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState('grid')
  const [levelFilter, setLevelFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [showFilters, setShowFilters] = useState(false)
  const [selectedState, setSelectedState] = useState(null)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeIssues, setActiveIssues] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const PAGE_SIZE = 40

  const buildParams = (offset = 0) => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (levelFilter !== 'all') params.set('level', levelFilter)
    if (selectedState) params.set('state', selectedState)
    if (activeIssues.length > 0) params.set('issues', activeIssues.join(','))
    params.set('limit', String(PAGE_SIZE))
    if (offset) params.set('offset', String(offset))
    return params
  }

  const getEndpoint = (params) => {
    return searchQuery
      ? `/search?${params.toString()}`
      : selectedState
        ? `/search/candidates/by-location?${params.toString()}`
        : `/candidates?${params.toString()}`
  }

  useEffect(() => {
    setLoading(true)
    const params = buildParams()
    api.get(getEndpoint(params))
      .then(data => {
        const results = data.candidates || []
        setCandidates(results)
        setHasMore(results.length >= PAGE_SIZE)
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false))
  }, [levelFilter, selectedState, activeIssues])

  const handleSearch = () => {
    setLoading(true)
    const params = buildParams()
    api.get(getEndpoint(params))
      .then(data => {
        const results = data.candidates || []
        setCandidates(results)
        setHasMore(results.length >= PAGE_SIZE)
      })
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false))
  }

  const loadMore = () => {
    setLoadingMore(true)
    const params = buildParams(candidates.length)
    api.get(getEndpoint(params))
      .then(data => {
        const results = data.candidates || []
        setCandidates(prev => [...prev, ...results])
        setHasMore(results.length >= PAGE_SIZE)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  const handleStateClick = (abbr) => {
    setSelectedState(prev => prev === abbr ? null : abbr)
  }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <h1>Find Your Candidates</h1>
          <p className="page-subtitle">
            Explore candidates at every level of government. See where they stand, ask questions, hold them accountable.
          </p>
        </div>
      </div>

      {/* Map Section */}
      <div className="container" style={{ paddingTop: '2rem' }}>
        <div style={{
          background: 'white',
          borderRadius: '12px',
          border: '1px solid var(--slate-200)',
          padding: '1.5rem',
          marginBottom: '2rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--navy-700)' }}>
              {selectedState
                ? <>Showing candidates in <strong>{STATE_NAMES[selectedState] || selectedState}</strong></>
                : 'Click a state to filter candidates'}
            </h3>
            {selectedState && (
              <button
                onClick={() => setSelectedState(null)}
                className="btn btn-secondary"
                style={{ padding: '0.25rem 0.75rem', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
          <USMap onStateClick={handleStateClick} selectedState={selectedState} />
        </div>
      </div>

      {/* Search and Filters */}
      <div className="container">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
            <input
              type="text"
              placeholder="Search candidates or races..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ paddingLeft: '3rem' }}
            />
          </div>

          <div style={{ position: 'relative' }}>
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              style={{ appearance: 'none', paddingRight: '2.5rem', minWidth: '150px', cursor: 'pointer' }}
            >
              {levels.map(level => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
            <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--slate-500)' }} />
          </div>

          <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)} style={{ padding: '0.75rem 1rem' }}>
            <Filter size={18} /> Filters
          </button>

          <button className="btn btn-primary" onClick={handleSearch} style={{ padding: '0.75rem 1rem' }}>
            Search
          </button>

          <div style={{ display: 'flex', border: '1px solid var(--slate-300)', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              onClick={() => setViewMode('grid')}
              style={{ padding: '0.5rem 0.75rem', background: viewMode === 'grid' ? 'var(--navy-700)' : 'white', color: viewMode === 'grid' ? 'white' : 'var(--slate-600)', border: 'none', cursor: 'pointer' }}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{ padding: '0.5rem 0.75rem', background: viewMode === 'list' ? 'var(--navy-700)' : 'white', color: viewMode === 'list' ? 'white' : 'var(--slate-600)', border: 'none', borderLeft: '1px solid var(--slate-300)', cursor: 'pointer' }}
            >
              <List size={18} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <h4 style={{ marginBottom: '1rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--slate-600)' }}>
              Filter by Issue
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {issueFilters.map(issue => (
                <button
                  key={issue}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.375rem 0.75rem',
                    fontSize: '0.875rem',
                    background: activeIssues.includes(issue) ? 'var(--navy-700)' : undefined,
                    color: activeIssues.includes(issue) ? 'white' : undefined,
                  }}
                  onClick={() => setActiveIssues(prev =>
                    prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
                  )}
                >
                  {issue}
                  {activeIssues.includes(issue) && <X size={14} style={{ marginLeft: '0.25rem' }} />}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: '1rem', color: 'var(--slate-600)' }}>
          {loading ? 'Loading...' : <>Showing <strong>{candidates.length}</strong> candidates</>}
        </div>

        {/* Candidate Grid */}
        <div className={viewMode === 'grid' ? 'candidate-grid' : ''} style={{ marginBottom: '3rem' }}>
          {candidates.map(candidate => (
            <Link
              to={`/candidate/${candidate.id}`}
              key={candidate.id}
              className="card candidate-card"
              style={viewMode === 'list' ? { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '1rem', padding: '1.25rem' } : {}}
            >
              <div className="candidate-card-top" style={viewMode === 'list' ? { marginBottom: 0, flex: 1 } : {}}>
                <div className="candidate-avatar">
                  {(candidate.display_name || candidate.first_name || 'C').charAt(0)}
                  {(candidate.last_name || '').charAt(0)}
                </div>
                <div className="candidate-info">
                  <h4 className="candidate-name">{candidate.display_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Candidate'}</h4>
                  <div className="candidate-race">{candidate.race_name || candidate.official_title || ''}</div>
                  <div className="candidate-badges">
                    {candidate.candidate_verified && (
                      <span className="badge badge-verified"><CheckCircle size={12} /> Verified</span>
                    )}
                    {candidate.is_incumbent && (
                      <span className="badge badge-incumbent">Incumbent</span>
                    )}
                    {!candidate.candidate_verified && (
                      <span className="badge" style={{ background: 'var(--slate-100)', color: 'var(--slate-600)' }}>Pending Verification</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="candidate-stats" style={viewMode === 'list' ? { borderTop: 'none', borderLeft: '1px solid var(--slate-200)', paddingTop: 0, paddingLeft: '1.5rem', marginTop: 0, marginLeft: '1.5rem', minWidth: '200px' } : {}}>
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
                  <div className="stat-value">{candidate.total_questions_received || 0}</div>
                  <div className="stat-label">Questions</div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!loading && hasMore && (
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <button className="btn btn-secondary" onClick={loadMore} disabled={loadingMore} style={{ padding: '0.75rem 2rem' }}>
              {loadingMore ? 'Loading...' : 'Load More Candidates'}
            </button>
          </div>
        )}

        {!loading && candidates.length === 0 && (
          <div className="empty-state">
            <h3>No candidates found</h3>
            <p>Try a different search or filter, or check back as more candidates join the platform.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default ExplorePage
