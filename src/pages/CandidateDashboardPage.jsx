import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Users, MessageSquare, CheckCircle, Megaphone, Target, Edit, ExternalLink, ArrowRight, Send, ThumbsUp, Clock, BarChart3, TrendingUp, SortAsc, Eye } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { formatRelative } from '../utils/dateFormat'
import { SkeletonStatCard, SkeletonCard } from '../components/Skeleton'
import Breadcrumbs from '../components/Breadcrumbs'
import OnboardingModal from '../components/OnboardingModal'

function CandidateDashboardPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ followers: 0, pendingQuestions: 0, answeredQuestions: 0, townHalls: 0, promises: 0 })
  const [pendingQuestions, setPendingQuestions] = useState([])
  const [recentPosts, setRecentPosts] = useState([])
  const [answerText, setAnswerText] = useState({})
  const [submittingAnswer, setSubmittingAnswer] = useState(null)
  const [newPost, setNewPost] = useState({ content: '', postType: 'update' })
  const [creatingPost, setCreatingPost] = useState(false)
  const [error, setError] = useState(null)
  const [questionSort, setQuestionSort] = useState('most_upvoted')
  const [promises, setPromises] = useState([])
  const [showPreview, setShowPreview] = useState(false)
  const [analytics, setAnalytics] = useState({ responseRate: 0, topTopics: [], totalQuestions: 0, answeredCount: 0 })

  const profileId = user?.candidate_profile_id

  useEffect(() => {
    if (!user || user.user_type !== 'candidate' || !profileId) {
      setLoading(false)
      return
    }

    const fetchDashboard = async () => {
      setLoading(true)
      try {
        const [questionsData, postsData, statsData, promisesData, answeredData] = await Promise.all([
          api.get(`/questions/candidate/${profileId}?status=pending`, true).catch(() => ({ questions: [] })),
          api.get(`/posts/candidate/${profileId}`, true).catch(() => ({ posts: [] })),
          api.get(`/candidates/${profileId}/stats`, true).catch(() => null),
          api.get(`/candidates/${profileId}/promises`, true).catch(() => ({ promises: [] })),
          api.get(`/questions/candidate/${profileId}?status=answered`, true).catch(() => ({ questions: [] })),
        ])

        const questions = questionsData.questions || []
        const answered = answeredData.questions || []
        setPendingQuestions(questions)
        setRecentPosts((postsData.posts || []).slice(0, 5))
        setPromises((promisesData.promises || []).slice(0, 3))

        if (statsData) {
          setStats(prev => ({ ...prev, ...statsData }))
        } else {
          setStats(prev => ({
            ...prev,
            pendingQuestions: questions.length,
            answeredQuestions: answered.length,
          }))
        }

        // Compute analytics from available data
        const totalQ = questions.length + answered.length
        const answeredCount = answered.length
        const responseRate = totalQ > 0 ? Math.round((answeredCount / totalQ) * 100) : 0

        // Extract top topics from question text
        const allQuestions = [...questions, ...answered]
        const topicKeywords = [
          'economy', 'jobs', 'tax', 'healthcare', 'health', 'education', 'school',
          'climate', 'environment', 'immigration', 'housing', 'crime', 'safety',
          'gun', 'abortion', 'infrastructure', 'transport', 'budget', 'military',
          'defense', 'social security', 'medicare', 'energy', 'technology',
        ]
        const topicCounts = {}
        allQuestions.forEach(q => {
          const text = (q.question_text || q.text || '').toLowerCase()
          topicKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
              const display = keyword.charAt(0).toUpperCase() + keyword.slice(1)
              topicCounts[display] = (topicCounts[display] || 0) + 1
            }
          })
        })
        const topTopics = Object.entries(topicCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name, count]) => ({ name, count }))

        setAnalytics({ responseRate, topTopics, totalQuestions: totalQ, answeredCount })
      } catch {
        setError('Failed to load dashboard data')
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [user, profileId])

  const sortedQuestions = [...pendingQuestions].sort((a, b) => {
    if (questionSort === 'most_upvoted') return (b.upvote_count || 0) - (a.upvote_count || 0)
    if (questionSort === 'oldest_first') return new Date(a.created_at) - new Date(b.created_at)
    if (questionSort === 'newest_first') return new Date(b.created_at) - new Date(a.created_at)
    return 0
  })

  const handleAnswerSubmit = async (questionId) => {
    const text = answerText[questionId]
    if (!text?.trim()) return
    setSubmittingAnswer(questionId)
    try {
      await api.post(`/questions/${questionId}/answer`, { answerText: text.trim() }, true)
      setPendingQuestions(prev => prev.filter(q => q.id !== questionId))
      setAnswerText(prev => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
      setStats(prev => ({
        ...prev,
        pendingQuestions: Math.max(0, prev.pendingQuestions - 1),
        answeredQuestions: prev.answeredQuestions + 1,
      }))
    } catch (err) {
      alert(err.message || 'Failed to submit answer')
    } finally {
      setSubmittingAnswer(null)
    }
  }

  const handleCreatePost = async (e) => {
    e.preventDefault()
    if (!newPost.content.trim()) return
    setCreatingPost(true)
    try {
      const data = await api.post('/posts', {
        content: newPost.content.trim(),
        postType: newPost.postType,
      }, true)
      setRecentPosts(prev => [data.post || data, ...prev].slice(0, 5))
      setNewPost({ content: '', postType: 'update' })
      setShowPreview(false)
    } catch (err) {
      alert(err.message || 'Failed to create post')
    } finally {
      setCreatingPost(false)
    }
  }

  const formatDate = (dateStr) => formatRelative(dateStr)

  const getPromiseStatusBadge = (status) => {
    const styles = {
      kept: { background: 'var(--success)', color: 'white' },
      in_progress: { background: 'var(--warning, #f59e0b)', color: 'white' },
      broken: { background: 'var(--error)', color: 'white' },
      pending: { background: 'var(--slate-200)', color: 'var(--slate-700)' },
      compromised: { background: '#f97316', color: 'white' },
    }
    const labels = {
      kept: 'Kept',
      in_progress: 'In Progress',
      broken: 'Broken',
      pending: 'Pending',
      compromised: 'Compromised',
    }
    return (
      <span style={{
        ...styles[status] || styles.pending,
        borderRadius: '999px',
        padding: '0.125rem 0.5rem',
        fontSize: '0.75rem',
        fontWeight: 600,
      }}>
        {labels[status] || status}
      </span>
    )
  }

  if (!user || user.user_type !== 'candidate') {
    return (
      <div className="container" style={{ padding: '4rem 0', textAlign: 'center' }}>
        <div className="empty-state">
          <h3>Candidate access required</h3>
          <p>You need a candidate account to access the dashboard.</p>
          <Link to="/run" className="btn btn-primary" style={{ marginTop: '1rem' }}>Learn About Running</Link>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="container">
            <h1>Your Dashboard</h1>
            <p className="page-subtitle">Manage your campaign, answer voter questions, and share updates.</p>
          </div>
        </div>
        <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonStatCard key={i} />
            ))}
          </div>
          <SkeletonCard height={200} />
          <div style={{ marginTop: '1.5rem' }}>
            <SkeletonCard height={200} />
          </div>
        </div>
      </div>
    )
  }

  const dashboardOnboardingSteps = [
    { title: 'Welcome to Your Dashboard', description: 'This is your command center. Monitor your campaign, track engagement, and stay on top of voter interactions.', icon: <BarChart3 size={28} /> },
    { title: 'Answer Voter Questions', description: 'Voters can submit questions directly to you. Respond promptly to boost your transparency score and build trust.', icon: <MessageSquare size={28} /> },
    { title: 'Post Updates', description: 'Share campaign updates, policy positions, and announcements with your followers and the broader community.', icon: <Megaphone size={28} /> },
    { title: 'Track Your Promises', description: 'Keep yourself accountable. Log your campaign promises and update their status as you work to fulfill them.', icon: <Target size={28} /> },
  ]

  return (
    <div>
      <OnboardingModal pageKey="candidate_dashboard" steps={dashboardOnboardingSteps} />

      <div className="page-header">
        <div className="container">
          <Breadcrumbs items={[{ label: 'Home', path: '/' }, { label: 'Dashboard' }]} />
          <h1>Your Dashboard</h1>
          <p className="page-subtitle">Manage your campaign, answer voter questions, and share updates.</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
        {error && <div role="alert" aria-live="assertive" style={{ background: 'var(--error-bg, #fef2f2)', color: 'var(--error)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>{error}</div>}

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <Users size={24} style={{ color: 'var(--navy-600)', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy-700)' }}>{stats.followers || 0}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>Followers</div>
          </div>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <Clock size={24} style={{ color: 'var(--warning, #f59e0b)', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy-700)' }}>{stats.pendingQuestions || pendingQuestions.length}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>Questions Pending</div>
          </div>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <CheckCircle size={24} style={{ color: 'var(--success)', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy-700)' }}>{stats.answeredQuestions || 0}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>Questions Answered</div>
          </div>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <Megaphone size={24} style={{ color: 'var(--navy-600)', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy-700)' }}>{stats.townHalls || 0}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>Town Halls Held</div>
          </div>
          <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
            <Target size={24} style={{ color: 'var(--burgundy-600, #991b1b)', marginBottom: '0.5rem' }} />
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--navy-700)' }}>{stats.promises || 0}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--slate-500)' }}>Promises Made</div>
          </div>
        </div>

        {/* Your Analytics */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <BarChart3 size={20} /> Your Analytics
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            {/* Response Rate */}
            <div style={{ padding: '1rem', border: '1px solid var(--slate-200)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <TrendingUp size={18} style={{ color: 'var(--success)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-700)' }}>Response Rate</span>
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--navy-700)', lineHeight: 1 }}>
                {analytics.responseRate}%
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)', marginTop: '0.375rem' }}>
                {analytics.answeredCount} of {analytics.totalQuestions} questions answered
              </div>
              {analytics.totalQuestions > 0 && (
                <div style={{ marginTop: '0.5rem', height: '6px', background: 'var(--slate-200)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${analytics.responseRate}%`,
                    background: analytics.responseRate >= 80 ? 'var(--success)' : analytics.responseRate >= 50 ? 'var(--warning)' : 'var(--error)',
                    borderRadius: '3px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              )}
            </div>

            {/* Top Topics */}
            <div style={{ padding: '1rem', border: '1px solid var(--slate-200)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <MessageSquare size={18} style={{ color: 'var(--navy-600)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-700)' }}>Top Question Topics</span>
              </div>
              {analytics.topTopics.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {analytics.topTopics.map((topic, idx) => (
                    <div key={topic.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--slate-700)' }}>
                        {idx + 1}. {topic.name}
                      </span>
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 600,
                        background: 'var(--slate-100)', padding: '0.125rem 0.5rem',
                        borderRadius: '999px', color: 'var(--slate-600)',
                      }}>
                        {topic.count} {topic.count === 1 ? 'question' : 'questions'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem', margin: 0 }}>
                  No topics detected yet. Topics are extracted from voter questions.
                </p>
              )}
            </div>

            {/* Profile Views */}
            <div style={{ padding: '1rem', border: '1px solid var(--slate-200)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <Users size={18} style={{ color: 'var(--burgundy-600, #991b1b)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--slate-700)' }}>Engagement</span>
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--slate-600)', lineHeight: 1.6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span>Total questions received</span>
                  <span style={{ fontWeight: 600, color: 'var(--navy-700)' }}>{analytics.totalQuestions}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.375rem' }}>
                  <span>Awaiting response</span>
                  <span style={{ fontWeight: 600, color: 'var(--warning)' }}>{pendingQuestions.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Profile views</span>
                  <span style={{ fontStyle: 'italic', color: 'var(--slate-500)' }}>Coming soon</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Questions */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={20} /> Pending Questions
              {pendingQuestions.length > 0 && (
                <span style={{ background: 'var(--warning, #f59e0b)', color: 'white', borderRadius: '999px', padding: '0.125rem 0.625rem', fontSize: '0.8125rem', fontWeight: 600 }}>
                  {pendingQuestions.length}
                </span>
              )}
            </h3>
            {pendingQuestions.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <SortAsc size={16} style={{ color: 'var(--slate-500)' }} />
                <select
                  value={questionSort}
                  onChange={e => setQuestionSort(e.target.value)}
                  style={{ fontSize: '0.8125rem', padding: '0.375rem 0.75rem', maxWidth: 180 }}
                >
                  <option value="most_upvoted">Most Upvoted</option>
                  <option value="oldest_first">Oldest First</option>
                  <option value="newest_first">Newest First</option>
                </select>
              </div>
            )}
          </div>

          {pendingQuestions.length === 0 ? (
            <p style={{ color: 'var(--slate-500)', margin: 0 }}>No pending questions. You're all caught up!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {sortedQuestions.map(q => {
                const answer = answerText[q.id] || ''
                const isEmptyAnswer = !answer.trim()
                return (
                  <div key={q.id} style={{ padding: '1rem', border: '1px solid var(--slate-200)', borderRadius: '8px' }}>
                    <div style={{ marginBottom: '0.75rem' }}>
                      <p style={{ margin: '0 0 0.5rem', fontWeight: 500, lineHeight: 1.5 }}>{q.question_text || q.text}</p>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                        {(q.asked_by_name || q.user_name) && <span>Asked by {q.asked_by_name || q.user_name}</span>}
                        {q.created_at && <span>{formatDate(q.created_at)}</span>}
                        {q.upvote_count > 0 && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <ThumbsUp size={12} /> {q.upvote_count}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <textarea
                          value={answer}
                          onChange={e => setAnswerText(prev => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="Write your answer..."
                          rows={2}
                          style={{ resize: 'vertical', width: '100%' }}
                        />
                        {answer.length > 0 && isEmptyAnswer && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--error)', marginTop: '0.25rem' }}>
                            Answer cannot be empty or whitespace only.
                          </div>
                        )}
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1rem', flexShrink: 0 }}
                        disabled={submittingAnswer === q.id || isEmptyAnswer}
                        onClick={() => handleAnswerSubmit(q.id)}
                        title={isEmptyAnswer ? 'Write an answer before submitting' : ''}
                      >
                        <Send size={16} /> {submittingAnswer === q.id ? 'Sending...' : 'Answer'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Promise Summary */}
        {promises.length > 0 && (
          <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Target size={20} /> Promise Tracker
              </h3>
              <Link to={`/candidate/${profileId}#promises`} style={{ fontSize: '0.875rem', color: 'var(--navy-600)', fontWeight: 600, textDecoration: 'none' }}>
                Manage All →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {promises.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', border: '1px solid var(--slate-200)', borderRadius: '8px' }}>
                  <p style={{ margin: 0, flex: 1, lineHeight: 1.5, fontSize: '0.9375rem' }}>
                    {p.promise_text.length > 120 ? p.promise_text.slice(0, 120) + '...' : p.promise_text}
                  </p>
                  <div style={{ flexShrink: 0, marginLeft: '1rem' }}>
                    {getPromiseStatusBadge(p.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Posts */}
        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
          <h3 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Megaphone size={20} /> Recent Posts
          </h3>

          {/* Create Post Form */}
          {!showPreview ? (
            <form onSubmit={e => { e.preventDefault(); if (newPost.content.trim()) setShowPreview(true) }} style={{ marginBottom: '1.5rem', padding: '1rem', background: 'var(--slate-50, #f8fafc)', borderRadius: '8px' }}>
              <textarea
                value={newPost.content}
                onChange={e => setNewPost(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Share an update with your constituents..."
                rows={3}
                style={{ resize: 'vertical', marginBottom: '0.75rem' }}
              />
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={newPost.postType}
                  onChange={e => setNewPost(prev => ({ ...prev, postType: e.target.value }))}
                  style={{ maxWidth: 200 }}
                >
                  <option value="update">Update</option>
                  <option value="announcement">Announcement</option>
                  <option value="position">Position Statement</option>
                </select>
                <button className="btn btn-secondary" type="submit" disabled={!newPost.content.trim()} style={{ padding: '0.5rem 1rem' }}>
                  <Eye size={16} /> Preview
                </button>
                <button className="btn btn-primary" type="button" disabled={creatingPost || !newPost.content.trim()} style={{ padding: '0.5rem 1rem' }} onClick={handleCreatePost}>
                  {creatingPost ? 'Posting...' : 'Publish'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
              {/* Post Preview */}
              <div style={{ padding: '1rem', background: 'var(--slate-50, #f8fafc)', borderRadius: '8px', marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--navy-600)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Post Preview
                </div>
                <div style={{ padding: '0.75rem 1rem', border: '1px solid var(--slate-200)', borderRadius: '8px', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 0.375rem', lineHeight: 1.5 }}>{newPost.content}</p>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                        <span style={{
                          background: newPost.postType === 'announcement' ? 'var(--navy-100, #e0e7ff)' : newPost.postType === 'position' ? 'var(--burgundy-100, #fce4ec)' : 'var(--slate-100)',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                        }}>
                          {newPost.postType.replace(/_/g, ' ')}
                        </span>
                        <span>just now</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }} onClick={() => setShowPreview(false)}>
                  <Edit size={16} /> Edit
                </button>
                <button className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} disabled={creatingPost} onClick={handleCreatePost}>
                  {creatingPost ? 'Posting...' : 'Publish'}
                </button>
              </div>
            </div>
          )}

          {recentPosts.length === 0 ? (
            <p style={{ color: 'var(--slate-500)', margin: 0 }}>No posts yet. Share your first update above!</p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {recentPosts.map(post => (
                  <div key={post.id} style={{ padding: '0.75rem 1rem', border: '1px solid var(--slate-200)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ margin: '0 0 0.375rem', lineHeight: 1.5 }}>{post.content}</p>
                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                          <span style={{
                            background: post.post_type === 'announcement' ? 'var(--navy-100, #e0e7ff)' : post.post_type === 'position' ? 'var(--burgundy-100, #fce4ec)' : 'var(--slate-100)',
                            padding: '0.125rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                          }}>
                            {(post.post_type || 'update').replace(/_/g, ' ')}
                          </span>
                          {post.created_at && <span>{formatDate(post.created_at)}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                <Link to={`/candidate/${profileId}#posts`} style={{ fontSize: '0.875rem', color: 'var(--navy-600)', fontWeight: 600, textDecoration: 'none' }}>
                  View All Posts →
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Quick Links */}
        <div>
          <h3 style={{ marginBottom: '1rem' }}>Quick Links</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <Link to="/candidate/edit" className="card" style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'box-shadow 0.2s' }}>
              <Edit size={20} style={{ color: 'var(--navy-600)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>Edit Profile</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>Update your information</div>
              </div>
              <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--slate-400)', flexShrink: 0 }} />
            </Link>
            <Link to={`/candidate/${profileId}`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'box-shadow 0.2s' }}>
              <ExternalLink size={20} style={{ color: 'var(--navy-600)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>View Public Profile</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>See what voters see</div>
              </div>
              <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--slate-400)', flexShrink: 0 }} />
            </Link>
            <Link to={`/candidate/${profileId}#promises`} className="card" style={{ padding: '1.25rem', textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'box-shadow 0.2s' }}>
              <Target size={20} style={{ color: 'var(--burgundy-600, #991b1b)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>Manage Promises</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>Track your commitments</div>
              </div>
              <ArrowRight size={16} style={{ marginLeft: 'auto', color: 'var(--slate-400)', flexShrink: 0 }} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CandidateDashboardPage
