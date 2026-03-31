import React, { useState } from 'react'

function partyFill(party) {
  if (!party) return '#94a3b8'
  const p = party.toLowerCase()
  if (p.includes('dem')) return '#2563eb'
  if (p.includes('rep')) return '#dc2626'
  return '#7c3aed'
}

function marginOpacity(margin) {
  if (margin == null) return 0.7
  const m = Math.abs(margin)
  if (m >= 20) return 1
  if (m >= 10) return 0.85
  if (m >= 5) return 0.7
  return 0.5
}

export default function DistrictMapSVG({ districts, stateName }) {
  const [tooltip, setTooltip] = useState(null)

  if (!districts || districts.length === 0) return null

  const count = districts.length
  const cols = Math.ceil(Math.sqrt(count))
  const rows = Math.ceil(count / cols)
  const cellW = 52
  const cellH = 44
  const gap = 4
  const svgW = cols * (cellW + gap) - gap + 20
  const svgH = rows * (cellH + gap) - gap + 20

  const totalDem = districts.reduce((s, d) => s + (d.dem_votes || 0), 0)
  const totalRep = districts.reduce((s, d) => s + (d.rep_votes || 0), 0)
  const totalVotes = totalDem + totalRep
  const demVotePct = totalVotes > 0 ? (totalDem / totalVotes) * 100 : 50
  const repVotePct = totalVotes > 0 ? (totalRep / totalVotes) * 100 : 50

  const demSeats = districts.filter(d => (d.winner_party || '').toLowerCase().includes('dem')).length
  const repSeats = districts.filter(d => (d.winner_party || '').toLowerCase().includes('rep')).length
  const demSeatPct = count > 0 ? (demSeats / count) * 100 : 50
  const repSeatPct = count > 0 ? (repSeats / count) * 100 : 50

  const barW = svgW - 20

  return (
    <div style={{ position: 'relative' }}>
      {stateName && (
        <h4 style={{ fontSize: 14, fontWeight: 700, color: '#0f172a', margin: '0 0 8px' }}>
          {stateName} Districts
        </h4>
      )}

      <svg
        width={svgW}
        height={svgH + 80}
        viewBox={`0 0 ${svgW} ${svgH + 80}`}
        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
      >
        {/* District grid */}
        {districts.map((d, i) => {
          const col = i % cols
          const row = Math.floor(i / cols)
          const x = 10 + col * (cellW + gap)
          const y = 10 + row * (cellH + gap)
          const fill = partyFill(d.winner_party)
          const opacity = marginOpacity(d.winner_margin)

          return (
            <g key={d.district_number ?? i}>
              <rect
                x={x} y={y} width={cellW} height={cellH}
                rx={6} ry={6}
                fill={fill} opacity={opacity}
                stroke="#fff" strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(e) => setTooltip({
                  x: e.clientX,
                  y: e.clientY,
                  district: d,
                })}
                onMouseMove={(e) => setTooltip(prev =>
                  prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                )}
                onMouseLeave={() => setTooltip(null)}
              />
              <text
                x={x + cellW / 2} y={y + cellH / 2}
                textAnchor="middle" dominantBaseline="central"
                fill="#fff" fontSize={12} fontWeight={700}
                pointerEvents="none"
              >
                {d.district_number != null ? d.district_number : i + 1}
              </text>
            </g>
          )
        })}

        {/* Summary bars */}
        {totalVotes > 0 && (
          <g transform={`translate(10, ${svgH + 10})`}>
            <text y={0} fontSize={11} fontWeight={600} fill="#475569">Vote Share</text>
            <rect x={0} y={6} width={barW} height={14} rx={3} fill="#f1f5f9" />
            <rect x={0} y={6} width={barW * (demVotePct / 100)} height={14} rx={3} fill="#2563eb" opacity={0.85} />
            <text x={4} y={17} fontSize={9} fontWeight={700} fill="#fff">
              D {demVotePct.toFixed(1)}%
            </text>
            <text x={barW - 4} y={17} fontSize={9} fontWeight={700} fill="#dc2626" textAnchor="end">
              R {repVotePct.toFixed(1)}%
            </text>

            <text y={38} fontSize={11} fontWeight={600} fill="#475569">Seat Share</text>
            <rect x={0} y={44} width={barW} height={14} rx={3} fill="#f1f5f9" />
            <rect x={0} y={44} width={barW * (demSeatPct / 100)} height={14} rx={3} fill="#2563eb" opacity={0.85} />
            <text x={4} y={55} fontSize={9} fontWeight={700} fill="#fff">
              D {demSeats} ({demSeatPct.toFixed(1)}%)
            </text>
            <text x={barW - 4} y={55} fontSize={9} fontWeight={700} fill="#dc2626" textAnchor="end">
              R {repSeats} ({repSeatPct.toFixed(1)}%)
            </text>
          </g>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && tooltip.district && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 12,
          top: tooltip.y - 10,
          padding: '8px 12px',
          background: '#1e293b',
          color: '#f8fafc',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 500,
          zIndex: 100,
          pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          whiteSpace: 'nowrap',
        }}>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            District {tooltip.district.district_number ?? '?'}
          </div>
          <div>
            Winner: <span style={{ color: partyFill(tooltip.district.winner_party) === '#2563eb' ? '#93c5fd' : '#fca5a5' }}>
              {tooltip.district.winner_party || 'Unknown'}
            </span>
          </div>
          {tooltip.district.winner_margin != null && (
            <div>Margin: {Math.abs(tooltip.district.winner_margin).toFixed(1)}%</div>
          )}
          {(tooltip.district.dem_votes != null || tooltip.district.rep_votes != null) && (
            <div style={{ marginTop: 2, fontSize: 11, color: '#94a3b8' }}>
              D: {(tooltip.district.dem_votes || 0).toLocaleString()} / R: {(tooltip.district.rep_votes || 0).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
