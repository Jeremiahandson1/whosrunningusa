import React, { useState, useEffect } from 'react'
import { WidgetBase, SourceLink, THEMES } from '../shared/widget-base'
import { widgetFetch, formatDollars } from '../shared/api'

const COLORS = {
  individual: '#7c3aed',
  organizational: '#2563eb',
  unaccounted: '#dc2626',
}

function Bar({ segments, total, theme }) {
  if (!total || total <= 0) return null
  return (
    <div style={{
      height: 28,
      borderRadius: 6,
      overflow: 'hidden',
      display: 'flex',
      background: theme.border,
    }}>
      {segments.map((seg, i) => {
        const pct = (seg.value / total) * 100
        if (pct <= 0) return null
        return (
          <div
            key={i}
            title={`${seg.label}: ${formatDollars(seg.value)} (${Math.round(pct)}%)`}
            style={{
              width: `${pct}%`,
              background: seg.color,
              transition: 'width 0.4s ease',
              minWidth: pct > 0 ? 2 : 0,
            }}
          />
        )
      })}
    </div>
  )
}

function CandidateBar({ entry, theme }) {
  const individual = Number(entry.disclosed_individual || 0)
  const organizational = Number(entry.disclosed_organizational || 0)
  const unaccounted = Number(entry.unaccounted || 0)
  const total = individual + organizational + unaccounted
  const unaccountedPct = total > 0 ? (unaccounted / total) * 100 : 0

  const segments = [
    { label: 'Disclosed Individual', value: individual, color: COLORS.individual },
    { label: 'Disclosed Organizational', value: organizational, color: COLORS.organizational },
    { label: 'Unaccounted', value: unaccounted, color: COLORS.unaccounted },
  ]

  return (
    <div style={{ marginBottom: 16 }}>
      {entry.name && (
        <div style={{ fontWeight: 600, fontSize: 13, color: theme.text, marginBottom: 6 }}>
          {entry.name}
          {entry.party && <span style={{ fontWeight: 400, color: theme.textSecondary }}> ({entry.party})</span>}
        </div>
      )}

      <Bar segments={segments} total={total} theme={theme} />

      {/* Numbers */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS.individual, marginRight: 4, verticalAlign: 'middle' }} />
          <span style={{ color: theme.textSecondary }}>Individual: </span>
          <span style={{ fontWeight: 600, color: theme.text }}>{formatDollars(individual)}</span>
        </div>
        <div style={{ fontSize: 12 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS.organizational, marginRight: 4, verticalAlign: 'middle' }} />
          <span style={{ color: theme.textSecondary }}>Organizational: </span>
          <span style={{ fontWeight: 600, color: theme.text }}>{formatDollars(organizational)}</span>
        </div>
        <div style={{ fontSize: 12 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: COLORS.unaccounted, marginRight: 4, verticalAlign: 'middle' }} />
          <span style={{ color: theme.textSecondary }}>Unaccounted: </span>
          <span style={{ fontWeight: 600, color: theme.text }}>{formatDollars(unaccounted)}</span>
        </div>
      </div>

      {/* Red callout */}
      {unaccountedPct > 15 && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: 6,
          fontSize: 12,
          color: '#991b1b',
          fontWeight: 600,
        }}>
          {Math.round(unaccountedPct)}% of funding sources are unaccounted for
        </div>
      )}
    </div>
  )
}

export default function DarkMoneyMeter({ config }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!config.candidate && !config.race) {
      setError('No candidate or race specified')
      setLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        if (config.race) {
          const result = await widgetFetch(`/dark-money/race/${config.race}`)
          setData({ candidates: result.candidates || result })
        } else {
          const result = await widgetFetch(`/dark-money/candidates/${config.candidate}`)
          setData({ candidates: [result] })
        }
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [config.candidate, config.race])

  const theme = THEMES[config.theme] || THEMES.light
  const candidates = data?.candidates || []
  const isRaceView = !!config.race

  return (
    <WidgetBase loading={loading} error={error} config={config} widgetType="dark-money-meter">
      {data && (
        <div className="wrusa-widget">
          <div style={{ fontWeight: 700, fontSize: 16, color: theme.text, marginBottom: 4 }}>
            Dark Money Meter
          </div>
          {isRaceView && (
            <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 14 }}>
              Funding comparison across {candidates.length} candidate{candidates.length !== 1 ? 's' : ''}
            </div>
          )}

          {candidates.map((c, i) => (
            <CandidateBar key={c.id || i} entry={c} theme={theme} />
          ))}

          {candidates.length === 0 && (
            <div style={{ textAlign: 'center', padding: 16, color: theme.textSecondary, fontSize: 13 }}>
              No funding data available.
            </div>
          )}

          {/* Methodology note */}
          <div style={{
            marginTop: 8,
            padding: '8px 10px',
            background: theme.cardBg,
            borderRadius: 4,
            fontSize: 11,
            color: theme.textSecondary,
            lineHeight: 1.45,
            border: `1px solid ${theme.border}`,
          }}>
            <strong>Methodology:</strong> Unaccounted = total outside spending minus all FEC-disclosed sources.
            This is a floor estimate.
          </div>
        </div>
      )}
    </WidgetBase>
  )
}
