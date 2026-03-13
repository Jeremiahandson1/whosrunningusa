import React from 'react'

const shimmerStyle = `
@keyframes skeleton-shimmer {
  0% { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
`

const baseStyle = {
  background: 'linear-gradient(90deg, var(--slate-200) 25%, var(--slate-100) 50%, var(--slate-200) 75%)',
  backgroundSize: '800px 100%',
  animation: 'skeleton-shimmer 1.5s ease-in-out infinite',
  borderRadius: '6px',
}

function SkeletonText({ lines = 3, width = '100%' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', width }}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          style={{
            ...baseStyle,
            height: '0.875rem',
            width: i === lines - 1 && lines > 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  )
}

function SkeletonAvatar({ size = 64 }) {
  return (
    <div
      style={{
        ...baseStyle,
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
      }}
    />
  )
}

function SkeletonCard({ height = 180 }) {
  return (
    <div className="card" style={{ padding: '1.5rem', height }}>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <SkeletonAvatar />
        <div style={{ flex: 1 }}>
          <SkeletonText lines={2} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: 'auto' }}>
        <div style={{ ...baseStyle, height: '2rem', flex: 1 }} />
        <div style={{ ...baseStyle, height: '2rem', flex: 1 }} />
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5, columns = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', gap: '1rem', padding: '0.75rem 1rem' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            style={{
              ...baseStyle,
              height: '0.75rem',
              flex: i === 1 ? 2 : 1,
            }}
          />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="card"
          style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div
              key={colIdx}
              style={{
                ...baseStyle,
                height: '1rem',
                flex: colIdx === 1 ? 2 : 1,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function SkeletonStatCard() {
  return (
    <div className="card" style={{ padding: '1.25rem', textAlign: 'center' }}>
      <div style={{ ...baseStyle, width: 24, height: 24, margin: '0 auto 0.5rem', borderRadius: '4px' }} />
      <div style={{ ...baseStyle, width: '3rem', height: '1.75rem', margin: '0 auto 0.5rem' }} />
      <div style={{ ...baseStyle, width: '5rem', height: '0.75rem', margin: '0 auto' }} />
    </div>
  )
}

function SkeletonProfile() {
  return (
    <div>
      {/* Header skeleton */}
      <div style={{ background: 'var(--navy-800)', padding: '3rem 0 4rem' }}>
        <div className="container">
          <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <SkeletonAvatar size={120} />
            <div style={{ flex: 1 }}>
              <div style={{ ...baseStyle, height: '2rem', width: '250px', marginBottom: '0.75rem', opacity: 0.3 }} />
              <div style={{ ...baseStyle, height: '1.25rem', width: '180px', marginBottom: '0.75rem', opacity: 0.2 }} />
              <div style={{ ...baseStyle, height: '1rem', width: '140px', opacity: 0.15 }} />
            </div>
          </div>
        </div>
      </div>
      {/* Stats bar skeleton */}
      <div style={{ background: 'white', borderBottom: '1px solid var(--slate-200)', marginTop: '-2rem', position: 'relative', zIndex: 1 }}>
        <div className="container">
          <div className="card" style={{ display: 'flex', justifyContent: 'space-around', padding: '1.5rem', borderRadius: '12px', transform: 'translateY(-50%)', flexWrap: 'wrap', gap: '1rem' }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ ...baseStyle, width: '3rem', height: '1.5rem', margin: '0 auto 0.5rem' }} />
                <div style={{ ...baseStyle, width: '5rem', height: '0.625rem', margin: '0 auto' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Content skeleton */}
      <div className="container" style={{ marginTop: '-1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--slate-200)', marginBottom: '2rem', paddingBottom: '0.5rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ ...baseStyle, width: '80px', height: '2.5rem' }} />
          ))}
        </div>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ ...baseStyle, width: 8, height: 40, borderRadius: 4 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ ...baseStyle, height: '1rem', width: '60%', marginBottom: '0.5rem' }} />
                    <div style={{ ...baseStyle, height: '0.875rem', width: '90%' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ width: 300, flexShrink: 0 }}>
            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
              <div style={{ ...baseStyle, height: '1.25rem', width: '60%', marginBottom: '1rem' }} />
              <div style={{ ...baseStyle, height: '2.5rem', width: '100%', marginBottom: '0.75rem' }} />
              <div style={{ ...baseStyle, height: '2.5rem', width: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* Inject shimmer keyframes once */
if (typeof document !== 'undefined') {
  const id = 'skeleton-shimmer-style'
  if (!document.getElementById(id)) {
    const style = document.createElement('style')
    style.id = id
    style.textContent = shimmerStyle
    document.head.appendChild(style)
  }
}

export { SkeletonCard, SkeletonText, SkeletonAvatar, SkeletonTable, SkeletonStatCard, SkeletonProfile }
