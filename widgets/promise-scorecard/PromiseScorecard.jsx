import React, { useState, useEffect } from 'react'
import { WidgetBase, SourceLink, THEMES } from '../shared/widget-base'
import { widgetFetch } from '../shared/api'

const STATUS_CONFIG = {
  kept: { label: 'Kept', color: '#16a34a', bg: '#f0fdf4' },
  broken: { label: 'Broken', color: '#dc2626', bg: '#fef2f2' },
  in_progress: { label: 'In Progress', color: '#ca8a04', bg: '#fefce8' },
  pending: { label: 'Pending', color: '#6b7280', bg: '#f9fafb' },
}

function scoreColor(score) {
  if (score > 70) return '#16a34a'
  if (score >= 40) return '#ca8a04'
  return '#dc2626'
}

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function PromiseScorecard({ config }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState({})

  useEffect(() => {
    if (!config.candidate) {
      setError('No candidate specified')
      setLoading(false)
      return
    }
    widgetFetch(`/promises/politician/${config.candidate}`)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [config.candidate])

  const theme = THEMES[config.theme] || THEMES.light

  const toggleSection = (key) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const promises = data?.promises || []
  const candidate = data?.candidate || {}
  const counts = { kept: 0, broken: 0, in_progress: 0, pending: 0 }
  promises.forEach(p => {
    const s = p.status || 'pending'
    if (counts[s] !== undefined) counts[s]++
  })
  const total = promises.length
  const score = total > 0 ? Math.round(((counts.kept * 1 + counts.in_progress * 0.5) / total) * 100) : null

  return (
    <WidgetBase loading={loading} error={error} config={config} widgetType="promise-scorecard">
      {data && (
        <div className="wrusa-widget">
          {/* Header */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>
              {candidate.name || 'Unknown Candidate'}
            </div>
            <div style={{ fontSize: 12, color: theme.textSecondary }}>
              {[candidate.office, candidate.party].filter(Boolean).join(' · ')}
            </div>
          </div>

          {/* Score */}
          {score !== null && (
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                display: 'inline-block',
                fontSize: 48,
                fontWeight: 800,
                lineHeight: 1,
                color: scoreColor(score),
              }}>
                {score}
              </div>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                Promise Score
              </div>
            </div>
          )}

          {/* Counts */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => counts[key] > 0 && toggleSection(key)}
                style={{
                  background: expanded[key] ? cfg.bg : theme.cardBg,
                  border: `1px solid ${expanded[key] ? cfg.color : theme.border}`,
                  borderRadius: 8,
                  padding: '10px 4px',
                  textAlign: 'center',
                  cursor: counts[key] > 0 ? 'pointer' : 'default',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ fontSize: 22, fontWeight: 700, color: cfg.color }}>{counts[key]}</div>
                <div style={{ fontSize: 10, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {cfg.label}
                </div>
              </button>
            ))}
          </div>

          {/* Expanded sections */}
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            if (!expanded[key]) return null
            const filtered = promises.filter(p => (p.status || 'pending') === key)
            if (filtered.length === 0) return null
            return (
              <div key={key} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: cfg.color, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {cfg.label} ({filtered.length})
                </div>
                {filtered.map((p, i) => (
                  <div
                    key={p.id || i}
                    style={{
                      padding: '10px 12px',
                      marginBottom: 6,
                      background: cfg.bg,
                      borderRadius: 6,
                      borderLeft: `3px solid ${cfg.color}`,
                    }}
                  >
                    <div style={{ fontSize: 13, color: theme.text, marginBottom: 4 }}>
                      {p.text || p.description}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="wrusa-badge" style={{ background: cfg.color, color: '#fff' }}>
                        {cfg.label}
                      </span>
                      {p.date && (
                        <span style={{ fontSize: 11, color: theme.textSecondary }}>
                          {formatDate(p.date)}
                        </span>
                      )}
                    </div>
                    {p.auto_check_vote && (
                      <div style={{
                        marginTop: 8,
                        padding: '6px 8px',
                        background: theme.bg,
                        borderRadius: 4,
                        fontSize: 11,
                        color: theme.textSecondary,
                        border: `1px solid ${theme.border}`,
                      }}>
                        <strong>Vote record:</strong> {p.auto_check_vote}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          })}

          {total === 0 && (
            <div style={{ textAlign: 'center', padding: 16, color: theme.textSecondary, fontSize: 13 }}>
              No tracked promises for this candidate.
            </div>
          )}
        </div>
      )}
    </WidgetBase>
  )
}
