import React, { useState, useEffect } from 'react'
import { WidgetBase, SourceLink, THEMES } from '../shared/widget-base'
import { widgetFetch, formatPct } from '../shared/api'

const SITE_URL = 'https://whosrunningusa.com'

export default function RubberStampWidget({ config }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const theme = THEMES[config?.theme] || THEMES.light

  useEffect(() => {
    if (!config.candidate) {
      setError('No candidate specified')
      setLoading(false)
      return
    }

    widgetFetch(`/rubber-stamp/politician/${config.candidate}`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [config.candidate])

  const partyPct = data?.party_alignment_pct ?? 0
  const donorPct = data?.donor_alignment_pct ?? 0
  const isRubberStamp = partyPct > 80 && donorPct > 80

  return (
    <WidgetBase loading={loading} error={error} config={config} widgetType="rubber-stamp">
      <div style={{ minWidth: 340 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: theme.text }}>
            {data?.politician_name || 'Voting Independence'}
          </div>
          {isRubberStamp && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 10px',
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 700,
              background: theme.danger + '18',
              color: theme.danger,
              border: `1px solid ${theme.danger}30`,
            }}>
              <StampIcon size={12} color={theme.danger} />
              Rubber Stamp
            </span>
          )}
        </div>

        {/* Two large numbers */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <ScoreCard
            label="Votes with party"
            value={partyPct}
            theme={theme}
          />
          <ScoreCard
            label="Votes with top donors"
            value={donorPct}
            theme={theme}
          />
        </div>

        {/* Party loyalty bar */}
        <BarSection
          label="Party loyalty"
          pct={partyPct}
          color={barColor(partyPct, 'party')}
          theme={theme}
        />

        {/* Donor alignment bar */}
        <BarSection
          label="Donor alignment"
          pct={donorPct}
          color={barColor(donorPct, 'donor')}
          theme={theme}
        />

        {/* Notable votes */}
        {data?.notable_votes && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textSecondary, marginBottom: 8 }}>
              Notable Votes
            </div>

            {data.notable_votes.contradicted_donors?.length > 0 && (
              <VoteGroup
                title="Contradicted donors"
                votes={data.notable_votes.contradicted_donors.slice(0, 3)}
                badgeColor={theme.success}
                badgeLabel="Independent"
                candidateId={config.candidate}
                theme={theme}
              />
            )}

            {data.notable_votes.benefited_donors?.length > 0 && (
              <VoteGroup
                title="Benefited donors"
                votes={data.notable_votes.benefited_donors.slice(0, 3)}
                badgeColor={theme.warning}
                badgeLabel="Donor-aligned"
                candidateId={config.candidate}
                theme={theme}
              />
            )}
          </div>
        )}
      </div>
    </WidgetBase>
  )
}

function ScoreCard({ label, value, theme }) {
  return (
    <div style={{
      flex: 1,
      textAlign: 'center',
      padding: '12px 8px',
      borderRadius: 6,
      background: theme.cardBg,
      border: `1px solid ${theme.border}`,
    }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: theme.text, lineHeight: 1.1 }}>
        {formatPct(value)}
      </div>
      <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

function BarSection({ label, pct, color, theme }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: theme.textSecondary, marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: theme.text }}>{formatPct(pct)}</span>
      </div>
      <div className="wrusa-bar" style={{ background: theme.border }}>
        <div
          className="wrusa-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }}
        />
      </div>
    </div>
  )
}

function VoteGroup({ title, votes, badgeColor, badgeLabel, candidateId, theme }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: theme.textSecondary, marginBottom: 4 }}>
        {title}
      </div>
      {votes.map((vote, i) => (
        <div key={vote.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 13 }}>
          <span style={{
            display: 'inline-block',
            padding: '1px 6px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 600,
            background: badgeColor + '20',
            color: badgeColor,
            whiteSpace: 'nowrap',
          }}>
            {badgeLabel}
          </span>
          <a
            href={`${SITE_URL}/candidate/${candidateId}/votes${vote.vote_id ? `#vote-${vote.vote_id}` : ''}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: theme.accent,
              textDecoration: 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {vote.bill_title || vote.description || 'View vote'}
          </a>
        </div>
      ))}
    </div>
  )
}

function barColor(pct, type) {
  // Higher pct = more "rubber stamp" behavior = more intense color
  if (type === 'donor') {
    if (pct > 80) return '#dc2626' // red — very donor-aligned
    if (pct > 60) return '#ea580c' // orange
    if (pct > 40) return '#ca8a04' // amber
    return '#16a34a' // green — independent
  }
  // Party loyalty
  if (pct > 90) return '#dc2626'
  if (pct > 75) return '#ea580c'
  if (pct > 50) return '#ca8a04'
  return '#16a34a'
}

function StampIcon({ size = 16, color = '#dc2626' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ verticalAlign: 'middle' }}>
      <rect x="3" y="10" width="10" height="3" rx="0.5" fill={color} opacity="0.3" />
      <rect x="5.5" y="3" width="5" height="7" rx="1" fill={color} opacity="0.5" />
      <rect x="6" y="1" width="4" height="3" rx="1" fill={color} opacity="0.7" />
      <rect x="2" y="12" width="12" height="2" rx="0.5" fill={color} />
    </svg>
  )
}
