import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Rss, LogIn, UserPlus, Compass } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import { formatDate } from '../utils/dateFormat'
import CommunityNotes from '../components/CommunityNotes'

const POST_TYPE_STYLES = {
  update: { label: 'Update', bg: 'var(--slate-100)', color: 'var(--slate-700)' },
  announcement: { label: 'Announcement', bg: 'rgba(139, 41, 66, 0.1)', color: 'var(--burgundy-600)' },
  position: { label: 'Position', bg: 'rgba(26, 54, 93, 0.1)', color: 'var(--navy-700)' },
}

function PostFeedPage() {
  const { user } = useAuth()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [offset, setOffset] = useState(0)
  const LIMIT = 20

  const fetchPosts = async (currentOffset = 0, append = false) => {
    try {
      const data = await api.get(`/posts/feed?limit=${LIMIT}&offset=${currentOffset}`, true)
      const newPosts = Array.isArray(data) ? data : []
      if (append) {
        setPosts(prev => [...prev, ...newPosts])
      } else {
        setPosts(newPosts)
      }
      setHasMore(newPosts.length === LIMIT)
    } catch {
      if (!append) setPosts([])
      setHasMore(false)
    }
  }

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    setLoading(true)
    fetchPosts(0).finally(() => setLoading(false))
  }, [user])

  const handleLoadMore = async () => {
    const newOffset = offset + LIMIT
    setLoadingMore(true)
    await fetchPosts(newOffset, true)
    setOffset(newOffset)
    setLoadingMore(false)
  }

  if (!user) {
    return (
      <div style={{
        minHeight: 'calc(100vh - 72px - 200px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '3rem 1.5rem'
      }}>
        <div style={{ textAlign: 'center', maxWidth: 440 }}>
          <Rss size={48} style={{ color: 'var(--slate-300)', marginBottom: '1rem' }} />
          <h2 style={{ marginBottom: '0.5rem' }}>Sign in to see your feed</h2>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.5rem' }}>
            Follow candidates and get their latest updates, announcements, and positions all in one place.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <LogIn size={16} /> Sign In
            </Link>
            <Link to="/register" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={16} /> Register
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '2rem 1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Your Feed</h1>
        <p style={{ color: 'var(--slate-600)' }}>Updates from candidates you follow</p>
      </div>

      {loading ? (
        <div className="loading-state" style={{ padding: '4rem 0', textAlign: 'center' }}>
          <div className="loading-spinner" />
          Loading your feed...
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <Compass size={40} style={{ color: 'var(--slate-300)', marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No posts yet</h3>
          <p style={{ color: 'var(--slate-600)', marginBottom: '1.25rem' }}>
            Follow candidates to see their updates here
          </p>
          <Link to="/explore" className="btn btn-primary">
            Explore Candidates
          </Link>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {posts.map(post => {
              const typeStyle = POST_TYPE_STYLES[post.post_type] || POST_TYPE_STYLES.update
              return (
                <div key={post.id} className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <Link
                      to={`/candidate/${post.candidate_id}`}
                      style={{ fontWeight: 600, color: 'var(--navy-800)', textDecoration: 'none', fontSize: '1.0625rem' }}
                    >
                      {post.candidate_name}
                    </Link>
                    <span style={{
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.6rem',
                      borderRadius: '999px',
                      background: typeStyle.bg,
                      color: typeStyle.color,
                      whiteSpace: 'nowrap'
                    }}>
                      {typeStyle.label}
                    </span>
                  </div>
                  {post.title && (
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>{post.title}</h3>
                  )}
                  <p style={{ color: 'var(--slate-700)', lineHeight: 1.6, marginBottom: '0.75rem', whiteSpace: 'pre-wrap' }}>
                    {post.content}
                  </p>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                    {formatDate(post.created_at)}
                  </div>
                  <CommunityNotes contentType="post" contentId={post.id} />
                </div>
              )
            })}
          </div>

          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
              <button
                className="btn btn-secondary"
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading...' : 'Load More'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PostFeedPage
