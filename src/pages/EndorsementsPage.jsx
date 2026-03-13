import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Award, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import api from '../utils/api'
import Breadcrumbs from '../components/Breadcrumbs'

function EndorsementsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [endorsements, setEndorsements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '')
  const [page, setPage] = useState(() => {
    const p = searchParams.get('page')
    return p ? parseInt(p, 10) : 1
  })
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Sync URL params
  useEffect(() => {
    const next = new URLSearchParams()
    if (page > 1) next.set('page', String(page))
    if (search) next.set('search', search)
    setSearchParams(next, { replace: true })
  }, [page, search, setSearchParams])

  const fetchEndorsements = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (search) params.set('search', search)
      const data = await api.get(`/candidates/endorsements/list?${params}`)
      setEndorsements(data.endorsements || [])
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
    } catch (err) {
      setError(err.message || 'Failed to load endorsements')
      setEndorsements([])
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    fetchEndorsements()
  }, [fetchEndorsements])

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput.trim())
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearch('')
    setPage(1)
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Endorsements' }]} />
          <h1>Endorsements</h1>
          <p className="page-subtitle">
            Browse candidate-to-candidate endorsements. See who is supporting whom across races.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {/* Search bar */}
        <form onSubmit={handleSearch} style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.5rem', maxWidth: '480px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)' }} />
            <input
              type="text"
              placeholder="Search by candidate name..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem 0.75rem 0.625rem 2.25rem',
                border: '1px solid var(--slate-300)',
                borderRadius: '0.375rem',
                fontSize: '0.9375rem',
                fontFamily: 'var(--font-body)',
              }}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.625rem 1rem' }}>
            Search
          </button>
          {search && (
            <button type="button" className="btn btn-secondary" style={{ padding: '0.625rem 0.75rem' }} onClick={handleClearSearch}>
              Clear
            </button>
          )}
        </form>

        {search && !loading && (
          <p style={{ marginBottom: '1rem', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
            {total} result{total !== 1 ? 's' : ''} for "{search}"
          </p>
        )}

        {/* Loading */}
        {loading && <div className="loading-state">Loading endorsements...</div>}

        {/* Error */}
        {!loading && error && (
          <div className="error-state">
            <p>{error}</p>
            <button className="btn btn-secondary" onClick={fetchEndorsements} style={{ marginTop: '0.75rem' }}>
              Try Again
            </button>
          </div>
        )}

        {/* Endorsement cards */}
        {!loading && !error && endorsements.length > 0 && (
          <>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
              gap: '1.25rem',
            }}>
              {endorsements.map(e => (
                <div key={e.id} className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{
                      width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                      background: 'var(--navy-50)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Award size={18} style={{ color: 'var(--navy-600)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--slate-800)' }}>
                        <Link to={`/candidate/${e.endorser_id}`} style={{ color: 'var(--navy-600)', textDecoration: 'none' }}>
                          {e.endorser_name}
                        </Link>
                      </div>
                      {e.endorser_title && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>{e.endorser_title}</div>
                      )}
                      {e.endorser_party && (
                        <span className="badge" style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>{e.endorser_party}</span>
                      )}
                    </div>
                  </div>

                  <div style={{
                    fontSize: '0.8125rem', color: 'var(--slate-500)', textTransform: 'uppercase',
                    letterSpacing: '0.05em', fontWeight: 600, textAlign: 'center',
                  }}>
                    endorses
                  </div>

                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                    <div style={{
                      width: '2.5rem', height: '2.5rem', borderRadius: '50%',
                      background: 'var(--burgundy-50, #fdf2f2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Award size={18} style={{ color: 'var(--burgundy-500, #b91c1c)' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--slate-800)' }}>
                        <Link to={`/candidate/${e.endorsed_id}`} style={{ color: 'var(--navy-600)', textDecoration: 'none' }}>
                          {e.endorsed_name}
                        </Link>
                      </div>
                      {e.endorsed_title && (
                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>{e.endorsed_title}</div>
                      )}
                      {e.endorsed_party && (
                        <span className="badge" style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}>{e.endorsed_party}</span>
                      )}
                    </div>
                  </div>

                  {e.endorsement_text && (
                    <blockquote style={{
                      margin: '0.25rem 0 0 0', padding: '0.75rem',
                      background: 'var(--slate-50)', borderLeft: '3px solid var(--navy-300, #93c5fd)',
                      borderRadius: '0 0.25rem 0.25rem 0', fontSize: '0.875rem',
                      color: 'var(--slate-700)', fontStyle: 'italic', lineHeight: 1.5,
                    }}>
                      "{e.endorsement_text}"
                    </blockquote>
                  )}

                  <div style={{ fontSize: '0.8125rem', color: 'var(--slate-400)', marginTop: 'auto' }}>
                    {formatDate(e.created_at)}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                gap: '1rem', marginTop: '2rem',
              }}>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                >
                  <ChevronLeft size={16} /> Previous
                </button>
                <span style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                  Page {page} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary"
                  style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next <ChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!loading && !error && endorsements.length === 0 && (
          <div className="empty-state">
            <Award size={48} style={{ color: 'var(--slate-400)', marginBottom: '1rem' }} />
            <h3>{search ? 'No endorsements found' : 'No endorsements yet'}</h3>
            <p>
              {search
                ? `No endorsements match "${search}". Try a different search term.`
                : 'Endorsements will appear here as candidates endorse each other.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default EndorsementsPage
