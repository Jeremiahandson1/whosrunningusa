import React, { useState, useEffect, useCallback } from 'react'
import { ThumbsUp, ThumbsDown, MessageSquarePlus, Trash2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'

function CommunityNotes({ contentType, contentId }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const fetchNotes = useCallback(async () => {
    try {
      const data = await api.get(`/community-notes/${contentType}/${contentId}`, !!user)
      setNotes(data.notes || [])
    } catch {
      setNotes([])
    }
  }, [contentType, contentId, user])

  useEffect(() => {
    if (!contentType || !contentId) return
    setLoading(true)
    fetchNotes().finally(() => setLoading(false))
  }, [fetchNotes, contentType, contentId])

  const handleSubmit = async () => {
    if (!noteText.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/community-notes', { contentType, contentId, noteText: noteText.trim() }, true)
      setNoteText('')
      setShowForm(false)
      await fetchNotes()
    } catch (err) {
      setError(err.message || 'Failed to submit note')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async (noteId, vote) => {
    if (!user) return
    try {
      const data = await api.post(`/community-notes/${noteId}/vote`, { vote }, true)
      setNotes(prev => prev.map(n =>
        n.id === noteId
          ? { ...n, helpful_count: data.helpful_count, not_helpful_count: data.not_helpful_count, user_vote: data.user_vote }
          : n
      ))
    } catch { /* ignored */ }
  }

  const handleDelete = async (noteId) => {
    if (!confirm('Delete this note?')) return
    try {
      await api.delete(`/community-notes/${noteId}`, true)
      setNotes(prev => prev.filter(n => n.id !== noteId))
    } catch { /* ignored */ }
  }

  if (loading) return null

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--navy-800)' }}>Community Notes</h4>
        {user && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
              background: 'none', border: '1px solid var(--slate-300)', borderRadius: '6px',
              padding: '0.375rem 0.75rem', fontSize: '0.8125rem', color: 'var(--slate-600)',
              cursor: 'pointer'
            }}
          >
            <MessageSquarePlus size={14} /> Add a note
          </button>
        )}
      </div>

      {showForm && (
        <div style={{ background: 'var(--slate-50)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add context or clarification..."
            rows={3}
            maxLength={2000}
            style={{ width: '100%', marginBottom: '0.5rem', resize: 'vertical' }}
          />
          {error && (
            <p style={{ color: 'var(--error)', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>{error}</p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || !noteText.trim()}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              {submitting ? 'Submitting...' : 'Submit Note'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => { setShowForm(false); setNoteText(''); setError(null) }}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p style={{ color: 'var(--slate-500)', fontSize: '0.875rem', fontStyle: 'italic' }}>
          No community notes yet.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {notes.map(note => (
            <div
              key={note.id}
              style={{
                background: 'var(--slate-50)', padding: '1rem', borderRadius: '8px',
                borderLeft: '3px solid var(--slate-300)'
              }}
            >
              <p style={{ color: 'var(--slate-700)', margin: '0 0 0.5rem', lineHeight: 1.6, fontSize: '0.9375rem' }}>
                {note.note_text}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--slate-500)' }}>
                  {note.author_username && <>{note.author_username} &bull; </>}
                  {note.created_at && new Date(note.created_at).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {user && (
                    <>
                      <button
                        onClick={() => handleVote(note.id, 'helpful')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '0.8125rem', padding: '0.25rem',
                          color: note.user_vote === 'helpful' ? 'var(--success)' : 'var(--slate-500)'
                        }}
                        title="Helpful"
                      >
                        <ThumbsUp size={14} /> {note.helpful_count || 0}
                      </button>
                      <button
                        onClick={() => handleVote(note.id, 'not_helpful')}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          background: 'none', border: 'none', cursor: 'pointer',
                          fontSize: '0.8125rem', padding: '0.25rem',
                          color: note.user_vote === 'not_helpful' ? 'var(--error)' : 'var(--slate-500)'
                        }}
                        title="Not helpful"
                      >
                        <ThumbsDown size={14} /> {note.not_helpful_count || 0}
                      </button>
                    </>
                  )}
                  {!user && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--slate-500)' }}>
                      <ThumbsUp size={14} style={{ verticalAlign: 'middle' }} /> {note.helpful_count || 0}
                    </span>
                  )}
                  {user && (note.author_id === user.id || user.user_type === 'admin') && (
                    <button
                      onClick={() => handleDelete(note.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--slate-400)', padding: '0.25rem'
                      }}
                      title="Delete note"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default CommunityNotes
