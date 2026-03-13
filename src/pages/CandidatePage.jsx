import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  CheckCircle, MapPin, Calendar, MessageCircle, ThumbsUp,
  ChevronDown, ChevronUp, PlayCircle, FileText,
  Clock, AlertCircle, Share2, Bell, Award
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

function CandidatePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const [candidate, setCandidate] = useState(null)
  const [activeTab, setActiveTab] = useState('positions')
  const [expandedPosition, setExpandedPosition] = useState(null)
  const [questions, setQuestions] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [newQuestion, setNewQuestion] = useState('')
  const [askingQuestion, setAskingQuestion] = useState(false)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/candidates/${id}`).catch(() => null),
      api.get(`/questions/candidate/${id}`).catch(() => ({ questions: [] })),
      api.get(`/town-halls/candidate/${id}`).catch(() => ({ townHalls: [] })),
    ]).then(([cData, qData, thData]) => {
      const c = cData?.candidate || cData
      setCandidate(c)
      setQuestions(qData?.questions || [])
      setEvents(thData?.townHalls || [])
      if (c?.isFollowing) setFollowing(true)
    }).finally(() => setLoading(false))
  }, [id])

  const handleFollow = async () => {
    if (!user) return alert('Please sign in to follow candidates')
    setFollowLoading(true)
    try {
      if (following) {
        await api.delete(`/users/follow/${id}`, true)
        setFollowing(false)
      } else {
        await api.post(`/users/follow/${id}`, {}, true)
        setFollowing(true)
      }
    } catch (err) {
      alert(err.message || 'Failed to update follow status')
    } finally {
      setFollowLoading(false)
    }
  }

  const handleRsvp = async (townHallId) => {
    if (!user) return alert('Please sign in to RSVP')
    try {
      await api.post(`/town-halls/${townHallId}/rsvp`, {}, true)
      alert('RSVP confirmed!')
    } catch (err) {
      alert(err.message || 'Failed to RSVP')
    }
  }

  const handleAskQuestion = async () => {
    if (!newQuestion.trim() || !user) return
    setAskingQuestion(true)
    try {
      const data = await api.post('/questions', { candidate_id: id, question_text: newQuestion }, true)
      setQuestions([{ ...(data.question || {}), question_text: newQuestion, upvote_count: 0, status: 'pending', created_at: new Date().toISOString() }, ...questions])
      setNewQuestion('')
    } catch (err) {
      alert(err.message || 'Failed to submit question')
    } finally {
      setAskingQuestion(false)
    }
  }

  const handleUpvote = async (questionId) => {
    if (!user) return
    try {
      await api.post(`/questions/${questionId}/upvote`, {}, true)
      setQuestions(questions.map(q =>
        q.id === questionId ? { ...q, upvote_count: (q.upvote_count || 0) + 1 } : q
      ))
    } catch (_e) { /* ignored */ }
  }

  const getStanceColor = (stance) => {
    switch (stance) {
      case 'support': return 'var(--success)'
      case 'oppose': return 'var(--error)'
      case 'complicated': return 'var(--warning)'
      default: return 'var(--slate-500)'
    }
  }

  const getStanceLabel = (stance) => {
    switch (stance) {
      case 'support': return 'Supports'
      case 'oppose': return 'Opposes'
      case 'complicated': return 'It\'s Complicated'
      default: return 'No Position'
    }
  }

  if (loading) return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}><div className="loading-state">Loading candidate profile...</div></div>
  if (!candidate) return <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}><div className="empty-state"><h3>Candidate not found</h3><Link to="/explore" className="btn btn-primary" style={{ marginTop: '1rem' }}>Browse Candidates</Link></div></div>

  const name = candidate.display_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`.trim() || 'Candidate'
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div>
      {/* Profile Header */}
      <div style={{ background: 'linear-gradient(180deg, var(--navy-800) 0%, var(--navy-900) 100%)', color: 'white', padding: '3rem 0 4rem' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg, var(--burgundy-500) 0%, var(--burgundy-700) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                <h1 style={{ color: 'white', margin: 0 }}>{name}</h1>
                {candidate.candidate_verified && (
                  <span className="badge badge-verified" style={{ background: 'rgba(47, 133, 90, 0.2)' }}>
                    <CheckCircle size={12} /> Verified
                  </span>
                )}
              </div>
              <p style={{ fontSize: '1.25rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                {candidate.official_title || candidate.race_name || ''}
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9375rem', opacity: 0.8 }}>
                {(candidate.state || candidate.city) && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <MapPin size={16} /> {[candidate.city, candidate.state].filter(Boolean).join(', ')}
                  </span>
                )}
                {candidate.party_affiliation && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Award size={16} /> {candidate.party_affiliation}
                  </span>
                )}
              </div>
              {candidate.full_bio && (
                <p style={{ marginTop: '1rem', maxWidth: '600px', lineHeight: 1.6, opacity: 0.9 }}>
                  {candidate.full_bio}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary" style={{ background: 'white', color: 'var(--navy-800)' }} onClick={handleFollow} disabled={followLoading}>
                <Bell size={18} /> {followLoading ? '...' : following ? 'Following' : 'Follow'}
              </button>
              <button className="btn btn-secondary" style={{ borderColor: 'white', color: 'white' }} onClick={async () => {
                const url = window.location.href
                if (navigator.share) {
                  try { await navigator.share({ title: name, url }) } catch (_e) { /* ignored */ }
                } else {
                  await navigator.clipboard.writeText(url)
                  alert('Link copied to clipboard!')
                }
              }}>
                <Share2 size={18} /> Share
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--slate-200)', marginTop: '-2rem', position: 'relative', zIndex: 1 }}>
        <div className="container">
          <div className="card" style={{ display: 'flex', justifyContent: 'space-around', padding: '1.5rem', borderRadius: '12px', transform: 'translateY(-50%)', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="stat">
              <div className="stat-value" style={{ color: (candidate.qa_response_rate || 0) >= 80 ? 'var(--success)' : 'var(--warning)' }}>
                {candidate.qa_response_rate || 0}%
              </div>
              <div className="stat-label">Response Rate</div>
            </div>
            <div className="stat">
              <div className="stat-value">{candidate.total_questions_answered || 0}</div>
              <div className="stat-label">Questions Answered</div>
            </div>
            <div className="stat">
              <div className="stat-value">{(candidate.total_questions_received || 0) - (candidate.total_questions_answered || 0)}</div>
              <div className="stat-label">Pending Questions</div>
            </div>
            <div className="stat">
              <div className="stat-value">{candidate.town_halls_held || 0}</div>
              <div className="stat-label">Town Halls Held</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="container" style={{ marginTop: '-1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--slate-200)', marginBottom: '2rem', overflowX: 'auto' }}>
          {['positions', 'qa', 'events', 'endorsements'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ padding: '1rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === tab ? '2px solid var(--burgundy-500)' : '2px solid transparent', color: activeTab === tab ? 'var(--navy-800)' : 'var(--slate-600)', fontWeight: activeTab === tab ? 600 : 400, cursor: 'pointer', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
            >
              {tab === 'qa' ? 'Q&A' : tab}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '2rem', marginBottom: '3rem', flexWrap: 'wrap' }}>
          {/* Main Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {activeTab === 'positions' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Issue Positions</h2>
                {(candidate.positions || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {candidate.positions.map((pos, idx) => (
                      <div key={idx} className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <button
                          onClick={() => setExpandedPosition(expandedPosition === idx ? null : idx)}
                          style={{ width: '100%', padding: '1.25rem', background: 'none', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{ width: 8, height: 40, borderRadius: 4, background: getStanceColor(pos.stance) }} />
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--navy-800)', marginBottom: '0.25rem' }}>{pos.category_name || pos.issue_name || pos.category}</div>
                              <div style={{ fontSize: '0.9375rem', color: 'var(--slate-600)' }}>
                                <span style={{ color: getStanceColor(pos.stance), fontWeight: 500 }}>{getStanceLabel(pos.stance)}:</span> {pos.explanation || pos.summary}
                              </div>
                            </div>
                          </div>
                          {expandedPosition === idx ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                        {expandedPosition === idx && pos.explanation && (
                          <div style={{ padding: '1.25rem', paddingTop: 0, borderTop: '1px solid var(--slate-200)', marginTop: '-0.5rem', paddingLeft: '3.5rem' }}>
                            <p style={{ color: 'var(--slate-700)', lineHeight: 1.7 }}>{pos.explanation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><p>This candidate hasn't declared issue positions yet.</p></div>
                )}
              </div>
            )}

            {activeTab === 'qa' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <h2 style={{ margin: 0 }}>Questions & Answers</h2>
                </div>

                {user && (
                  <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
                    <textarea
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="Ask this candidate a question..."
                      rows={3}
                      style={{ marginBottom: '0.75rem', resize: 'vertical' }}
                    />
                    <button className="btn btn-primary" onClick={handleAskQuestion} disabled={askingQuestion || !newQuestion.trim()}>
                      {askingQuestion ? 'Submitting...' : 'Ask Question'}
                    </button>
                  </div>
                )}

                {!user && (
                  <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--slate-600)', marginBottom: '0.75rem' }}>Sign in to ask questions</p>
                    <Link to="/login" className="btn btn-primary">Sign In</Link>
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {questions.map(q => (
                    <div key={q.id} className="card" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', gap: '1rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 50 }}>
                          <button onClick={() => handleUpvote(q.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-500)', padding: '0.5rem' }}>
                            <ThumbsUp size={20} />
                          </button>
                          <span style={{ fontWeight: 600, color: 'var(--navy-700)' }}>{q.upvote_count || 0}</span>
                        </div>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontWeight: 500, color: 'var(--navy-800)', marginBottom: '0.5rem', fontSize: '1.0625rem' }}>{q.question_text}</p>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginBottom: '1rem' }}>
                            {q.asked_by_username && <>Asked by {q.asked_by_username} &bull; </>}
                            {q.created_at && new Date(q.created_at).toLocaleDateString()}
                          </div>
                          {q.answer_text ? (
                            <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--navy-600)' }}>
                              <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Candidate Response
                              </div>
                              <p style={{ color: 'var(--slate-700)', margin: 0 }}>{q.answer_text}</p>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', fontSize: '0.875rem' }}>
                              <AlertCircle size={16} /> Awaiting response
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {questions.length === 0 && (
                    <div className="empty-state"><p>No questions yet. Be the first to ask!</p></div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'events' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Upcoming Events</h2>
                {events.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {events.map(event => (
                      <div key={event.id} className="card" style={{ padding: '1.5rem', borderLeft: '3px solid var(--burgundy-500)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                          <div>
                            <span className="badge badge-candidate" style={{ marginBottom: '0.5rem' }}>
                              {event.format === 'video' ? 'Video Town Hall' : 'Text-Based AMA'}
                            </span>
                            <h4 style={{ marginBottom: '0.5rem' }}>{event.title}</h4>
                            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9375rem', color: 'var(--slate-600)', flexWrap: 'wrap' }}>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Calendar size={16} /> {new Date(event.scheduled_at).toLocaleDateString()}
                              </span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                <Clock size={16} /> {new Date(event.scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                          <button className="btn btn-primary" onClick={() => handleRsvp(event.id)}>RSVP</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><p>No upcoming events scheduled.</p></div>
                )}
              </div>
            )}

            {activeTab === 'endorsements' && (
              <div>
                <h2 style={{ marginBottom: '1.5rem' }}>Endorsements</h2>
                <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem' }}>
                  Peer-to-peer endorsements from other verified candidates.
                </p>
                {(candidate.endorsements || []).length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {candidate.endorsements.map((endorsement, idx) => (
                      <div key={idx} className="card" style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--slate-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: 'var(--slate-600)' }}>
                          {(endorsement.display_name || endorsement.name || 'E').split(' ').map(n => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: 'var(--navy-800)' }}>{endorsement.display_name || endorsement.name}</div>
                          {endorsement.official_title && <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)' }}>{endorsement.official_title}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state"><p>No endorsements yet.</p></div>
                )}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={{ width: 300, flexShrink: 0 }}>
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem' }}>Quick Actions</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => setActiveTab('qa')}>
                  <MessageCircle size={18} /> Ask a Question
                </button>
                <Link to={`/compare?candidate=${id}`} className="btn btn-secondary" style={{ width: '100%' }}>
                  <FileText size={18} /> Compare Candidates
                </Link>
              </div>
            </div>

            {events.length > 0 && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem' }}>Next Event</h4>
                <div>
                  <div style={{ fontWeight: 500, marginBottom: '0.25rem' }}>{events[0].title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)', marginBottom: '1rem' }}>
                    {new Date(events[0].scheduled_at).toLocaleDateString()} at {new Date(events[0].scheduled_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                  <button className="btn btn-accent" style={{ width: '100%' }} onClick={() => handleRsvp(events[0].id)}>
                    <PlayCircle size={18} /> RSVP Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CandidatePage
