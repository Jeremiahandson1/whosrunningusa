import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search, Filter, ChevronDown, CheckCircle,
  Grid, List, X, Map, Loader
} from 'lucide-react'
import api from '../utils/api'
import USMap from '../components/USMap'
import { SkeletonCard } from '../components/Skeleton'
import useDebounce from '../hooks/useDebounce'

const levels = [
  { value: 'all', label: 'All Levels' },
  { value: 'federal', label: 'Federal' },
  { value: 'state', label: 'State' },
  { value: 'county', label: 'County' },
  { value: 'local', label: 'Local' },
]

const sortOptions = [
  { value: 'response_rate', label: 'Most Responsive' },
  { value: 'questions_answered', label: 'Most Active' },
  { value: 'recently_joined', label: 'Recently Joined' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'most_followed', label: 'Most Followed' },
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [mapVisible, setMapVisible] = useState(true)
  const PAGE_SIZE = 40

  // Restore state from URL params
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [levelFilter, setLevelFilter] = useState(searchParams.get('level') || 'all')
  const [selectedState, setSelectedState] = useState(searchParams.get('state') || null)
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'response_rate')
  const [activeIssues, setActiveIssues] = useState(() => {
    const issues = searchParams.get('issues')
    return issues ? issues.split(',') : []
  })
  const [currentOffset, setCurrentOffset] = useState(() => {
    const o = searchParams.get('offset')
    return o ? parseInt(o, 10) : 0
  })

  const debouncedSearch = useDebounce(searchQuery, 300)
  const searchInputRef = useRef(null)

  // Sync state to URL params
  const syncParams = useCallback((overrides = {}) => {
    const next = new URLSearchParams()
    const q = overrides.q !== undefined ? overrides.q : searchQuery
    const lvl = overrides.level !== undefined ? overrides.level : levelFilter
    const st = overrides.state !== undefined ? overrides.state : selectedState
    const sort = overrides.sort !== undefined ? overrides.sort : sortBy
    const issues = overrides.issues !== undefined ? overrides.issues : activeIssues
    const off = overrides.offset !== undefined ? overrides.offset : currentOffset

    if (q) next.set('q', q)
    if (lvl !== 'all') next.set('level', lvl)
    if (st) next.set('state', st)
    if (sort !== 'response_rate') next.set('sort', sort)
    if (issues.length > 0) next.set('issues', issues.join(','))
    if (off > 0) next.set('offset', String(off))

    setSearchParams(next, { replace: true })
  }, [searchQuery, levelFilter, selectedState, sortBy, activeIssues, currentOffset, setSearchParams])

  const buildApiParams = useCallback((query, offset = 0) => {
    const params = new URLSearchParams()
    if (query) params.set('search', query)
    if (levelFilter !== 'all') params.set('officeLevel', levelFilter)
    if (selectedState) params.set('state', selectedState)
    if (activeIssues.length > 0) params.set('issues', activeIssues.join(','))
    if (sortBy) params.set('sort', sortBy)
    params.set('limit', String(PAGE_SIZE))
    if (offset) params.set('offset', String(offset))
    return params
  }, [levelFilter, selectedState, activeIssues, sortBy])

  const getEndpoint = useCallback((query, params) => {
    return selectedState
      ? `/search/candidates/by-location?${params.toString()}`
      : `/candidates?${params.toString()}`
  }, [selectedState])

  const fetchCandidates = useCallback((query) => {
    setLoading(true)
    setSearching(true)
    const params = buildApiParams(query)
    api.get(getEndpoint(query, params))
      .then(data => {
        const results = data.candidates || []
        setCandidates(results)
        setHasMore(results.length >= PAGE_SIZE)
      })
      .catch(() => setCandidates([]))
      .finally(() => {
        setLoading(false)
        setSearching(false)
      })
    setCurrentOffset(0)
  }, [buildApiParams, getEndpoint])

  // Main data fetch -- triggers on debounced search and all filters
  useEffect(() => {
    fetchCandidates(debouncedSearch)
    syncParams({ q: debouncedSearch, offset: 0 })
  }, [debouncedSearch, levelFilter, selectedState, activeIssues, sortBy])

  const handleSearch = () => {
    fetchCandidates(searchQuery)
  }

  const loadMore = () => {
    setLoadingMore(true)
    const newOffset = candidates.length
    const params = buildApiParams(debouncedSearch, newOffset)
    api.get(getEndpoint(debouncedSearch, params))
      .then(data => {
        const results = data.candidates || []
        setCandidates(prev => [...prev, ...results])
        setHasMore(results.length >= PAGE_SIZE)
        setCurrentOffset(newOffset)
        syncParams({ offset: newOffset })
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  const handleStateClick = (abbr) => {
    const next = selectedState === abbr ? null : abbr
    setSelectedState(next)
    syncParams({ state: next })
  }

  const handleLevelChange = (value) => {
    setLevelFilter(value)
    syncParams({ level: value })
  }

  const handleSortChange = (value) => {
    setSortBy(value)
    syncParams({ sort: value })
  }

  const toggleIssue = (issue) => {
    setActiveIssues(prev => {
      const next = prev.includes(issue) ? prev.filter(i => i !== issue) : [...prev, issue]
      syncParams({ issues: next })
      return next
    })
  }

  const clearAllFilters = () => {
    setSearchQuery('')
    setLevelFilter('all')
    setSelectedState(null)
    setSortBy('response_rate')
    setActiveIssues([])
    setCurrentOffset(0)
    setSearchParams({}, { replace: true })
  }

  const hasActiveFilters = searchQuery || levelFilter !== 'all' || selectedState || activeIssues.length > 0

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
        <button
          className="btn btn-secondary explore-map-toggle"
          onClick={() => setMapVisible(!mapVisible)}
          style={{ gap: '0.5rem' }}
        >
          <Map size={18} />
          {mapVisible ? 'Hide Map' : 'Select State on Map'}
        </button>

        <div className={`explore-map-section${mapVisible ? '' : ' collapsed'}`}>
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

        {/* State dropdown - visible on mobile as alternative to map */}
        <div className="explore-mobile-state-select" style={{ marginBottom: '1rem' }}>
          <select
            value={selectedState || ''}
            onChange={(e) => { const v = e.target.value || null; setSelectedState(v); syncParams({ state: v }) }}
            style={{ width: '100%' }}
          >
            <option value="">All States</option>
            {Object.entries(STATE_NAMES).sort((a, b) => a[1].localeCompare(b[1])).map(([abbr, name]) => (
              <option key={abbr} value={abbr}>{name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="container">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
            <label htmlFor="explore-search" className="sr-only">Search candidates or races</label>
            <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-500)' }} />
            <input
              ref={searchInputRef}
              id="explore-search"
              type="text"
              placeholder="Search candidates or races..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ paddingLeft: '3rem', paddingRight: searchQuery ? '4.5rem' : '1rem' }}
            />
            {/* Inline spinner + clear button */}
            <div style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              {searching && searchQuery && (
                <Loader size={16} style={{ color: 'var(--slate-400)', animation: 'spin 1s linear infinite' }} />
              )}
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.125rem', color: 'var(--slate-400)', display: 'flex', alignItems: 'center' }}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <label htmlFor="level-filter" className="sr-only">Filter by level of government</label>
            <select
              id="level-filter"
              value={levelFilter}
              onChange={(e) => handleLevelChange(e.target.value)}
              style={{ appearance: 'none', paddingRight: '2.5rem', minWidth: '150px', cursor: 'pointer' }}
            >
              {levels.map(level => (
                <option key={level.value} value={level.value}>{level.label}</option>
              ))}
            </select>
            <ChevronDown size={18} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--slate-500)' }} />
          </div>

          {/* Sort dropdown */}
          <div style={{ position: 'relative' }}>
            <label htmlFor="sort-filter" className="sr-only">Sort candidates</label>
            <select
              id="sort-filter"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              style={{ appearance: 'none', paddingRight: '2.5rem', minWidth: '170px', cursor: 'pointer' }}
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
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
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
              style={{ padding: '0.5rem 0.75rem', background: viewMode === 'grid' ? 'var(--navy-700)' : 'white', color: viewMode === 'grid' ? 'white' : 'var(--slate-600)', border: 'none', cursor: 'pointer' }}
            >
              <Grid size={18} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
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
                  onClick={() => toggleIssue(issue)}
                >
                  {issue}
                  {activeIssues.includes(issue) && <X size={14} style={{ marginLeft: '0.25rem' }} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active filter summary bar */}
        {hasActiveFilters && (
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            padding: '0.75rem 1rem',
            background: 'var(--slate-50)',
            borderRadius: '8px',
            border: '1px solid var(--slate-200)',
          }} aria-live="polite">
            <span style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginRight: '0.25rem' }}>
              {loading ? 'Searching...' : <>Showing <strong>{candidates.length}</strong> candidates</>}
            </span>

            {searchQuery && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.5rem', background: 'var(--navy-50)', borderRadius: '9999px',
                fontSize: '0.8125rem', color: 'var(--navy-700)',
              }}>
                &quot;{searchQuery}&quot;
                <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--navy-600)', display: 'flex' }}>
                  <X size={12} />
                </button>
              </span>
            )}

            {levelFilter !== 'all' && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.5rem', background: 'var(--navy-50)', borderRadius: '9999px',
                fontSize: '0.8125rem', color: 'var(--navy-700)',
              }}>
                {levels.find(l => l.value === levelFilter)?.label}
                <button onClick={() => handleLevelChange('all')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--navy-600)', display: 'flex' }}>
                  <X size={12} />
                </button>
              </span>
            )}

            {selectedState && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.5rem', background: 'var(--navy-50)', borderRadius: '9999px',
                fontSize: '0.8125rem', color: 'var(--navy-700)',
              }}>
                {STATE_NAMES[selectedState] || selectedState}
                <button onClick={() => handleStateClick(selectedState)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--navy-600)', display: 'flex' }}>
                  <X size={12} />
                </button>
              </span>
            )}

            {activeIssues.map(issue => (
              <span key={issue} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.25rem 0.5rem', background: 'var(--navy-50)', borderRadius: '9999px',
                fontSize: '0.8125rem', color: 'var(--navy-700)',
              }}>
                {issue}
                <button onClick={() => toggleIssue(issue)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--navy-600)', display: 'flex' }}>
                  <X size={12} />
                </button>
              </span>
            ))}

            <button
              onClick={clearAllFilters}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', color: 'var(--error)', fontWeight: 600,
                marginLeft: 'auto',
              }}
            >
              Clear All
            </button>
          </div>
        )}

        {!hasActiveFilters && (
          <div style={{ marginBottom: '1rem', color: 'var(--slate-600)' }} aria-live="polite">
            {loading ? 'Searching...' : <>Showing <strong>{candidates.length}</strong> candidates</>}
          </div>
        )}

        {/* Skeleton loading grid */}
        {loading && (
          <div className="candidate-grid" style={{ marginBottom: '3rem' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Candidate Grid */}
        <div className={viewMode === 'grid' ? 'candidate-grid' : ''} style={{ marginBottom: '3rem', display: loading ? 'none' : undefined }}>
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
                  <div className="stat-label">
                    Response Rate{' '}
                    <span style={{ fontWeight: 600 }}>
                      ({(candidate.qa_response_rate || 0) >= 80 ? 'High' : (candidate.qa_response_rate || 0) >= 50 ? 'Medium' : 'Low'})
                    </span>
                  </div>
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
