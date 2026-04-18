import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle, ArrowRight, ArrowLeft, RotateCcw, Target, Zap, List } from 'lucide-react'
import api from '../utils/api'
import Breadcrumbs from '../components/Breadcrumbs'

// Pick one representative issue per category for the quick match
function pickQuickIssues(allIssues) {
  const seen = new Set()
  const picked = []
  for (const issue of allIssues) {
    const cat = issue.category_id || issue.category_name
    if (!seen.has(cat)) {
      seen.add(cat)
      picked.push(issue)
    }
    if (picked.length >= 8) break
  }
  return picked
}

function IssueMatchPage() {
  const [allIssues, setAllIssues] = useState([])
  const [mode, setMode] = useState(null) // null = choosing, 'quick', 'deep'
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
        setAllIssues(issueList)
      })
      .catch(() => setAllIssues([]))
      .finally(() => setLoading(false))
  }, [])

  const issues = mode === 'deep' ? allIssues : pickQuickIssues(allIssues)

  const handleStance = (issueId, stance) => {
    setPositions(prev => ({ ...prev, [issueId]: stance }))
    if (currentIdx < issues.length - 1) {
      setTimeout(() => setCurrentIdx(prev => prev + 1), 200)
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
    setMode(null)
  }

  const handleGoDeeper = () => {
    // Keep existing answers, switch to full set, jump to first unanswered
    setMode('deep')
    setResults(null)
    const firstUnanswered = allIssues.findIndex(i => !positions[i.id])
    setCurrentIdx(firstUnanswered >= 0 ? firstUnanswered : 0)
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

        {/* Mode Selection */}
        {mode === null && !results && allIssues.length > 0 && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              <button
                onClick={() => setMode('quick')}
                className="card"
                style={{
                  padding: '2rem 1.5rem', textAlign: 'center', cursor: 'pointer',
                  border: '2px solid var(--slate-200)', background: 'white',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--navy-600)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <Zap size={32} style={{ color: 'var(--navy-600)', marginBottom: '0.75rem' }} />
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--navy-800)' }}>Quick Match</h3>
                <p style={{ margin: 0, color: 'var(--slate-600)', fontSize: '0.9rem' }}>
                  8 key questions across the big topics. Takes about 2 minutes.
                </p>
              </button>

              <button
                onClick={() => setMode('deep')}
                className="card"
                style={{
                  padding: '2rem 1.5rem', textAlign: 'center', cursor: 'pointer',
                  border: '2px solid var(--slate-200)', background: 'white',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--navy-600)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.08)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--slate-200)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <List size={32} style={{ color: 'var(--navy-600)', marginBottom: '0.75rem' }} />
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', color: 'var(--navy-800)' }}>Deep Match</h3>
                <p style={{ margin: 0, color: 'var(--slate-600)', fontSize: '0.9rem' }}>
                  All {allIssues.length} issues for the most accurate results. Takes 5-10 minutes.
                </p>
              </button>
            </div>

            <p style={{ textAlign: 'center', color: 'var(--slate-500)', fontSize: '0.875rem' }}>
              You can always go deeper after a quick match.
            </p>
          </div>
        )}

        {/* Quiz */}
        {mode !== null && !results && issues.length > 0 && (
          <div>
            {/* Mode label + Progress */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--navy-600)', fontWeight: 600 }}>
                  {mode === 'quick' ? 'Quick Match' : 'Deep Match'}
                </span>
                <span style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>
                  {answeredCount} of {issues.length} answered
                </span>
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
                <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>{currentIssue.name}</h2>
                {currentIssue.description && (
                  <p style={{ color: 'var(--slate-600)', marginBottom: '2rem', maxWidth: 500, margin: '0 auto 2rem' }}>{currentIssue.description}</p>
                )}

                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[
                    { stance: 'support', label: 'Support', color: 'var(--success)' },
                    { stance: 'oppose', label: 'Oppose', color: 'var(--error)' },
                    { stance: 'complicated', label: "It's Complex", color: 'var(--warning)' },
                  ].map(({ stance, label, color }) => {
                    const selected = positions[currentIssue.id] === stance
                    return (
                      <button
                        key={stance}
                        className="btn"
                        onClick={() => handleStance(currentIssue.id, stance)}
                        style={{
                          padding: '0.75rem 2rem', fontSize: '1rem', minWidth: 120,
                          background: selected ? color : 'white',
                          color: selected ? 'white' : color,
                          border: `2px solid ${color}`,
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
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
                  <Target size={18} /> {matching ? 'Finding...' : `Find Matches (${answeredCount})`}
                </button>
              )}

              {!allDone ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => setCurrentIdx(prev => Math.min(issues.length - 1, prev + 1))}
                >
                  Next <ArrowRight size={18} />
                </button>
              ) : answeredCount >= 1 ? (
                <button className="btn btn-primary" onClick={handleMatch} disabled={matching}>
                  <Target size={18} /> {matching ? 'Finding...' : 'See My Matches'}
                </button>
              ) : null}
            </div>
          </div>
        )}

        {/* Results */}
        {results !== null && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <h2 style={{ margin: 0 }}>Your Matches</h2>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {mode === 'quick' && (
                  <button className="btn btn-secondary" onClick={handleGoDeeper}>
                    <List size={18} /> Go Deeper
                  </button>
                )}
                <button className="btn btn-secondary" onClick={handleReset}>
                  <RotateCcw size={18} /> Start Over
                </button>
              </div>
            </div>

            {results.length === 0 && (
              <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>No matches yet</h3>
                <p style={{ color: 'var(--slate-600)', marginBottom: '1rem', maxWidth: 480, margin: '0 auto 1rem' }}>
                  Candidates haven't recorded their positions on these issues yet.
                  As more candidates join and share where they stand, your matches will appear here.
                </p>
                <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Know a candidate? Encourage them to <Link to="/run-for-office" style={{ color: 'var(--navy-600)' }}>create a free profile</Link> and share their positions.
                </p>
                <Link to="/explore" className="btn btn-primary">
                  Browse All Candidates <ArrowRight size={18} />
                </Link>
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

            {mode === 'quick' && results.length > 0 && (
              <div style={{ textAlign: 'center', marginTop: '2rem', padding: '1.5rem', background: 'var(--slate-50)', borderRadius: 8 }}>
                <p style={{ margin: '0 0 0.75rem', color: 'var(--slate-700)' }}>
                  Want more accurate results? Answer all {allIssues.length} questions.
                </p>
                <button className="btn btn-secondary" onClick={handleGoDeeper}>
                  <List size={18} /> Go Deeper
                </button>
              </div>
            )}
          </div>
        )}

        {allIssues.length === 0 && !loading && (
          <div className="empty-state">
            <h3>Issue matching is warming up</h3>
            <p style={{ maxWidth: 500, margin: '0 auto 1rem' }}>
              We&apos;re building out our issue database as candidates publish their positions. In the meantime, you can find candidates by location, name, or office.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1rem' }}>
              <Link to="/find-my-ballot" className="btn btn-primary">Find My Ballot <ArrowRight size={18} /></Link>
              <Link to="/compare" className="btn btn-secondary">Compare Candidates</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default IssueMatchPage
