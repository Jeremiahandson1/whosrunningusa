import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MapPin, ChevronDown, ChevronUp, AlertTriangle, Trophy, ArrowUpDown } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

const YEARS = ['2024', '2022', '2020']

function gapColor(gap) {
  const abs = Math.abs(gap)
  if (abs > 0.07) return '#dc2626'
  if (abs > 0.04) return '#ca8a04'
  return '#16a34a'
}

function gapBg(gap) {
  const abs = Math.abs(gap)
  if (abs > 0.07) return '#fef2f2'
  if (abs > 0.04) return '#fefce8'
  return '#f0fdf4'
}

function gapLabel(gap) {
  const abs = Math.abs(gap)
  if (abs > 0.07) return 'Extreme'
  if (abs > 0.04) return 'Significant'
  return 'Reasonable'
}

function StateCard({ state, onToggle, expanded }) {
  const gap = state.efficiency_gap || 0
  const absGap = Math.abs(gap)
  const advantage = gap > 0 ? 'R' : gap < 0 ? 'D' : null
  const advantageColor = advantage === 'R' ? '#dc2626' : advantage === 'D' ? '#2563eb' : '#475569'

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden', border: `2px solid ${absGap > 0.07 ? '#fecaca' : absGap > 0.04 ? '#fde68a' : '#bbf7d0'}` }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '20px 24px', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: '#1e293b', marginBottom: 4 }}>{state.state_name}</div>
            <span style={{ background: gapBg(gap), color: gapColor(gap), fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
              {gapLabel(gap)}
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 2 }}>Efficiency Gap</div>
            <SourceCitation
              value={
                <span style={{ fontSize: 22, fontWeight: 800, color: gapColor(gap) }}>
                  {gap > 0 ? '+' : ''}{(gap * 100).toFixed(1)}%
                </span>
              }
              sourceUrl={state.source_url}
              sourceLabel={state.source_label || 'Election data'}
            />
            {advantage && (
              <div style={{ fontSize: 12, color: advantageColor, fontWeight: 600, marginTop: 2 }}>
                {advantage === 'R' ? 'R advantage' : 'D advantage'}
              </div>
            )}
          </div>
          {expanded ? <ChevronUp size={20} color="#475569" /> : <ChevronDown size={20} color="#475569" />}
        </div>

        {/* Vote share vs seat share bars */}
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* Dem */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              <span style={{ color: '#2563eb' }}>D vote share: {(state.dem_vote_share || 0).toFixed(1)}%</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${state.dem_vote_share || 0}%`, background: '#2563eb', borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginTop: 6, marginBottom: 4 }}>
              <span style={{ color: '#3b82f6' }}>D seat share: {(state.dem_seat_share || 0).toFixed(1)}%</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${state.dem_seat_share || 0}%`, background: '#3b82f6', borderRadius: 4, opacity: 0.6 }} />
            </div>
          </div>
          {/* Rep */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              <span style={{ color: '#dc2626' }}>R vote share: {(state.rep_vote_share || 0).toFixed(1)}%</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${state.rep_vote_share || 0}%`, background: '#dc2626', borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginTop: 6, marginBottom: 4 }}>
              <span style={{ color: '#ef4444' }}>R seat share: {(state.rep_seat_share || 0).toFixed(1)}%</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${state.rep_seat_share || 0}%`, background: '#ef4444', borderRadius: 4, opacity: 0.6 }} />
            </div>
          </div>
        </div>

        {/* Excess seats */}
        {state.excess_seats != null && state.excess_seats !== 0 && (
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600, color: advantageColor }}>
            Party {advantage} has {Math.abs(state.excess_seats)} excess seat{Math.abs(state.excess_seats) !== 1 ? 's' : ''}
          </div>
        )}
      </button>

      {/* Expanded: district-level results */}
      {expanded && state.districts && state.districts.length > 0 && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '16px 24px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, color: '#475569' }}>District</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: '#2563eb' }}>Dem Votes</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: '#dc2626' }}>Rep Votes</th>
                <th style={{ textAlign: 'center', padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Winner</th>
                <th style={{ textAlign: 'right', padding: '8px 12px', fontWeight: 700, color: '#475569' }}>Margin</th>
              </tr>
            </thead>
            <tbody>
              {state.districts.map((d, i) => {
                const winnerColor = d.winner === 'D' ? '#2563eb' : d.winner === 'R' ? '#dc2626' : '#475569'
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>{d.district_number || d.district}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#2563eb' }}>{(d.dem_votes || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626' }}>{(d.rep_votes || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <span style={{ background: `${winnerColor}15`, color: winnerColor, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999 }}>
                        {d.winner || '—'}
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>
                      {d.margin != null ? `${d.margin > 0 ? '+' : ''}${d.margin.toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {expanded && (!state.districts || state.districts.length === 0) && (
        <div style={{ borderTop: '1px solid #f1f5f9', padding: '20px 24px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
          District-level data not available for this state.
        </div>
      )}
    </div>
  )
}

function GerrymanderingPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [states, setStates] = useState([])
  const [worst, setWorst] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedState, setExpandedState] = useState(null)

  const year = searchParams.get('year') || '2024'
  const sort = searchParams.get('sort') || 'efficiency_gap'

  const fetchData = useCallback(async () => {
    setLoading(true)
    setExpandedState(null)
    try {
      const [statesData, worstData] = await Promise.all([
        api.get(`/gerrymandering?election_year=${year}&sort=${sort}`),
        api.get(`/gerrymandering/worst?election_year=${year}`),
      ])
      setStates(statesData.states || [])
      setWorst(worstData.states || worstData.worst || [])
    } catch (err) {
      setError(err.message || 'Failed to load gerrymandering data')
    } finally {
      setLoading(false)
    }
  }, [year, sort])

  useEffect(() => { fetchData() }, [fetchData])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next)
  }

  async function toggleExpand(stateItem) {
    if (expandedState === stateItem.state_abbr) {
      setExpandedState(null)
      return
    }
    // Fetch districts if not already loaded
    if (!stateItem.districts) {
      try {
        const data = await api.get(`/gerrymandering/${stateItem.state_abbr}?election_year=${year}`)
        stateItem.districts = data.districts || []
      } catch {
        stateItem.districts = []
      }
      setStates([...states])
    }
    setExpandedState(stateItem.state_abbr)
  }

  const selectStyle = { padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <MapPin size={36} /> The Gerrymandering Visualizer
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
          Vote share vs seat share. The math doesn't lie.
        </p>
      </section>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Year selector + sort */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: 20, background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: 24, alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>Election Year</span>
          {YEARS.map(y => (
            <button
              key={y}
              onClick={() => updateFilter('year', y)}
              style={{
                padding: '8px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: year === y ? '#1e293b' : '#f1f5f9', color: year === y ? '#fff' : '#475569',
              }}
            >
              {y}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#475569' }}>
            <ArrowUpDown size={14} /> Sort:
          </span>
          <select style={selectStyle} value={sort} onChange={e => updateFilter('sort', e.target.value)}>
            <option value="efficiency_gap">Efficiency Gap</option>
            <option value="excess_seats">Advantage Seats</option>
            <option value="name">State Name</option>
          </select>
        </div>

        {/* Worst states highlight */}
        {worst.length > 0 && !loading && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Trophy size={20} color="#dc2626" />
              <span style={{ fontWeight: 700, fontSize: 15, color: '#9f1239' }}>Worst Gerrymandered States ({year})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
              {worst.slice(0, 5).map((w, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 2 }}>{w.state_name}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#dc2626' }}>
                    {(Math.abs(w.efficiency_gap || 0) * 100).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 11, color: '#475569' }}>
                    {(w.efficiency_gap || 0) > 0 ? 'R advantage' : 'D advantage'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <p>Loading gerrymandering data...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>
            <AlertTriangle size={20} style={{ marginBottom: 8 }} />
            <div>{error}</div>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && states.length === 0 && (
          <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
            <MapPin size={48} color="#94a3b8" />
            <p style={{ fontSize: 18, marginTop: 12 }}>No gerrymandering data available for {year}.</p>
          </div>
        )}

        {/* State cards */}
        {!loading && !error && states.length > 0 && (
          <>
            <div style={{ fontSize: 14, color: '#475569', marginBottom: 16 }}>{states.length} state{states.length !== 1 ? 's' : ''} with data</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 32 }}>
              {states.map(s => (
                <StateCard
                  key={s.state_abbr}
                  state={s}
                  expanded={expandedState === s.state_abbr}
                  onToggle={() => toggleExpand(s)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default GerrymanderingPage
