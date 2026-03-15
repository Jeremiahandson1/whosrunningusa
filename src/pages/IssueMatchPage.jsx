import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, ArrowLeft, RotateCcw, Target } from 'lucide-react'
import api from '../utils/api'
import Breadcrumbs from '../components/Breadcrumbs'

function IssueMatchPage() {
  const [issues, setIssues] = useState([])
  const [positions, setPositions] = useState({})
  const [currentIdx, setCurrentIdx] = useState(0)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(true)
  const [matching, setMatching] = useState(false)
  const [state, setState] = useState('')

  useEffect(() => {
    api.get('/issues')
      .then(data => {
        const issueList = data.issues || data || []
        setIssues(issueList)
      })
      .catch(() => setIssues([]))
      .finally(() => setLoading(false))
  }, [])

  const handleStance = (issueId, stance) => {
    setPositions(prev => ({ ...prev, [issueId]: stance }))
    if (currentIdx < issues.length - 1) {
      setCurrentIdx(prev => prev + 1)
    }
  }

  const handleSkip = () => {
    if (currentIdx < issues.length - 1) {
      setCurrentIdx(prev => prev + 1)
    }
  }

  const handleMatch = async () => {
    const posArray = Object.entries(positions).map(([issueId, stance]) => ({
      issueId, stance
    }))
    if (posArray.length === 0) return

    setMatching(true)
    try {
      const body = { positions: posArray, limit: 20 }
      if (state) body.state = state
      const data = await api.post('/search/candidates/match', body)
      setResults(data.candidates || [])
    } catch {
      setResults([])
    } finally {
      setMatching(false)
    }
  }

  const handleReset = () => {
    setPositions({})
    setCurrentIdx(0)
    setResults(null)
  }

  const answeredCount = Object.keys(positions).length
  const currentIssue = issues[currentIdx]
  const allDone = currentIdx >= issues.length - 1 && issues.length > 0

  if (loading) return <div className="loading-state" style={{ padding: '4rem 0' }}>Loading issues...</div>

  return (
    <div>
      <div className="page-header">
        <div className="container">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Issue Match' }]} />
          <h1>Find Your Match</h1>
          <p className="page-subtitle">
            Tell us where you stand on the issues. We'll find candidates who share your views.
          </p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem', maxWidth: 700, margin: '0 auto' }}>
        {!results && issues.length > 0 && (
          <div>
            {/* Progress */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                <span>Question {currentIdx + 1} of {issues.length}</span>
                <span>{answeredCount} answered</span>
              </div>
              <div style={{ height: 6, background: 'var(--slate-200)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--burgundy-500)', borderRadius: 3, width: `${((currentIdx + 1) / issues.length) * 100}%`, transition: 'width 0.3s' }} />
              </div>
            </div>

            {/* Current Issue Card */}
            {currentIssue && (
              <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                {currentIssue.category_name && (
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--slate-500)', marginBottom: '0.5rem' }}>
                    {currentIssue.category_name}
                  </div>
                )}
                <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>{currentIssue.name}</h2>
                {currentIssue.description && (
                  <p style={{ color: 'var(--slate-600)', marginBottom: '2rem', maxWidth: 500, margin: '0 auto 2rem' }}>{currentIssue.description}</p>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    onClick={() => handleStance(currentIssue.id, 'support')}
                    style={{
                      padding: '0.75rem 2rem', fontSize: '1rem', minWidth: 120,
                      background: positions[currentIssue.id] === 'support' ? 'var(--success)' : 'white',
                      color: positions[currentIssue.id] === 'support' ? 'white' : 'var(--success)',
                      border: '2px solid var(--success)',
                    }}
                  >
                    Support
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleStance(currentIssue.id, 'oppose')}
                    style={{
                      padding: '0.75rem 2rem', fontSize: '1rem', minWidth: 120,
                      background: positions[currentIssue.id] === 'oppose' ? 'var(--error)' : 'white',
                      color: positions[currentIssue.id] === 'oppose' ? 'white' : 'var(--error)',
                      border: '2px solid var(--error)',
                    }}
                  >
                    Oppose
                  </button>
                  <button
                    className="btn"
                    onClick={() => handleStance(currentIssue.id, 'complicated')}
                    style={{
                      padding: '0.75rem 2rem', fontSize: '1rem', minWidth: 120,
                      background: positions[currentIssue.id] === 'complicated' ? 'var(--warning)' : 'white',
                      color: positions[currentIssue.id] === 'complicated' ? 'white' : 'var(--warning)',
                      border: '2px solid var(--warning)',
                    }}
                  >
                    It's Complex
                  </button>
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                  <button
                    onClick={handleSkip}
                    style={{ background: 'none', border: 'none', color: 'var(--slate-500)', cursor: 'pointer', fontSize: '0.875rem' }}
                    disabled={allDone}
                  >
                    Skip this issue
                  </button>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))}
                disabled={currentIdx === 0}
              >
                <ArrowLeft size={18} /> Back
              </button>

              {answeredCount >= 3 && (
                <button className="btn btn-primary" onClick={handleMatch} disabled={matching}>
                  <Target size={18} /> {matching ? 'Finding Matches...' : `Find Matches (${answeredCount} issues)`}
                </button>
              )}

              {!allDone && (
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentIdx(prev => Math.min(issues.length - 1, prev + 1))}
                >
                  Next <ArrowRight size={18} />
                </button>
              )}

              {allDone && answeredCount >= 1 && (
                <button className="btn btn-primary" onClick={handleMatch} disabled={matching}>
                  <Target size={18} /> {matching ? 'Finding Matches...' : 'See My Matches'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        {results !== null && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0 }}>Your Matches</h2>
              <button className="btn btn-secondary" onClick={handleReset}>
                <RotateCcw size={18} /> Start Over
              </button>
            </div>

            {results.length === 0 && (
              <div className="empty-state">
                <h3>No matches found</h3>
                <p>Try answering more questions or remove the state filter to search nationwide.</p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {results.map(c => {
                const name = c.display_name || 'Candidate'
                return (
                  <Link key={c.id} to={`/candidate/${c.id}`} className="card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: `conic-gradient(var(--success) ${(c.match_pct || 0) * 3.6}deg, var(--slate-200) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', color: 'var(--navy-800)' }}>
                          {c.match_pct || 0}%
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--navy-800)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                          {name}
                          {c.candidate_verified && <CheckCircle size={14} style={{ color: 'var(--success)' }} />}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                          {[c.party_affiliation, c.official_title].filter(Boolean).join(' • ')}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                          {c.matches} of {c.total_compared} positions match
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={20} style={{ color: 'var(--slate-400)' }} />
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {issues.length === 0 && !loading && (
          <div className="empty-state">
            <h3>No issues available yet</h3>
            <p>Check back later as we add more issues to match on.</p>
            <Link to="/explore" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Browse Candidates <ArrowRight size={18} />
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}

export default IssueMatchPage
