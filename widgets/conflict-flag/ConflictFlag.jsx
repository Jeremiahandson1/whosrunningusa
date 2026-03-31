import React, { useState, useEffect } from 'react'
import { WidgetBase, SourceLink, THEMES } from '../shared/widget-base'
import { widgetFetch, formatDollars } from '../shared/api'

const SEVERITY = {
  critical: { label: 'Critical', color: '#fff', bg: '#dc2626', border: '#dc2626' },
  high: { label: 'High', color: '#fff', bg: '#ea580c', border: '#ea580c' },
  medium: { label: 'Medium', color: '#78350f', bg: '#fbbf24', border: '#f59e0b' },
  low: { label: 'Low', color: '#374151', bg: '#d1d5db', border: '#9ca3af' },
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }

function formatDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function sortConflicts(conflicts) {
  return [...conflicts].sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4)
    if (sevDiff !== 0) return sevDiff
    return (Number(b.amount) || 0) - (Number(a.amount) || 0)
  })
}

function ConflictCard({ conflict, theme, candidateId }) {
  const sev = SEVERITY[conflict.severity] || SEVERITY.low
  const profileUrl = `https://whosrunningusa.com/candidate/${candidateId}`

  return (
    <div style={{
      marginBottom: 12,
      padding: '14px 16px',
      background: theme.cardBg,
      borderRadius: 8,
      border: `1px solid ${theme.border}`,
      borderLeft: `4px solid ${sev.border}`,
    }}>
      {/* Severity badge + amount */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span
          className="wrusa-badge"
          style={{ background: sev.bg, color: sev.color, fontSize: 11 }}
        >
          {sev.label}
        </span>
        {conflict.amount != null && (
          <span style={{ fontWeight: 700, fontSize: 14, color: theme.text }}>
            {formatDollars(conflict.amount)}
          </span>
        )}
      </div>

      {/* Description */}
      <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.5, marginBottom: 8 }}>
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: theme.accent, textDecoration: 'none', fontWeight: 600 }}
        >
          {conflict.description || conflict.summary || 'View conflict details'}
        </a>
      </div>

      {/* Trade details */}
      {conflict.trade_details && (
        <div style={{
          padding: '8px 10px',
          background: theme.bg,
          borderRadius: 4,
          border: `1px solid ${theme.border}`,
          fontSize: 12,
          color: theme.textSecondary,
          marginBottom: 6,
        }}>
          <strong>Trade:</strong> {conflict.trade_details}
        </div>
      )}

      {/* Timing + date */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: theme.textSecondary }}>
        {conflict.timing && (
          <span>Timing: {conflict.timing}</span>
        )}
        {conflict.date && (
          <span>{formatDate(conflict.date)}</span>
        )}
      </div>
    </div>
  )
}

export default function ConflictFlag({ config }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!config.candidate) {
      setError('No candidate specified')
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        const result = await widgetFetch(`/conflicts/politician/${config.candidate}`)
        setData(result)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [config.candidate])

  const theme = THEMES[config.theme] || THEMES.light

  let conflicts = data?.conflicts || []

  // Optional topic filter
  if (config.topic && conflicts.length > 0) {
    const topicLower = config.topic.toLowerCase()
    conflicts = conflicts.filter(c =>
      (c.topic || '').toLowerCase().includes(topicLower) ||
      (c.description || '').toLowerCase().includes(topicLower) ||
      (c.trade_details || '').toLowerCase().includes(topicLower)
    )
  }

  conflicts = sortConflicts(conflicts)
  const candidate = data?.candidate || {}

  return (
    <WidgetBase loading={loading} error={error} config={config} widgetType="conflict-flag">
      {data && (
        <div className="wrusa-widget">
          {/* Header */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: theme.text }}>
              Financial Conflict Flags
            </div>
            {candidate.name && (
              <div style={{ fontSize: 12, color: theme.textSecondary }}>
                {candidate.name}
                {candidate.office && ` · ${candidate.office}`}
              </div>
            )}
          </div>

          {conflicts.length > 0 ? (
            <>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 10 }}>
                {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
              </div>
              {conflicts.map((c, i) => (
                <ConflictCard
                  key={c.id || i}
                  conflict={c}
                  theme={theme}
                  candidateId={config.candidate}
                />
              ))}
            </>
          ) : (
            /* No conflicts — green card */
            <div style={{
              padding: '20px 16px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              textAlign: 'center',
            }}>
              <div style={{
                display: 'inline-block',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#16a34a',
                color: '#fff',
                lineHeight: '32px',
                fontSize: 18,
                marginBottom: 8,
              }}>
                &#10003;
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#166534', marginBottom: 6 }}>
                No financial conflicts detected in available disclosure data
              </div>
              <div style={{ fontSize: 11, color: '#4ade80', lineHeight: 1.4 }}>
                Note: Financial disclosures may be incomplete. Not all conflicts are detectable
                from public data sources.
              </div>
            </div>
          )}
        </div>
      )}
    </WidgetBase>
  )
}
