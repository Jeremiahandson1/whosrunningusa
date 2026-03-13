const STATES = [
  // Row 0
  { abbr: 'AK', row: 0, col: 0 },
  { abbr: 'ME', row: 0, col: 10 },
  // Row 1
  { abbr: 'WI', row: 1, col: 5 },
  { abbr: 'VT', row: 1, col: 9 },
  { abbr: 'NH', row: 1, col: 10 },
  // Row 2
  { abbr: 'WA', row: 2, col: 0 },
  { abbr: 'ID', row: 2, col: 1 },
  { abbr: 'MT', row: 2, col: 2 },
  { abbr: 'ND', row: 2, col: 3 },
  { abbr: 'MN', row: 2, col: 4 },
  { abbr: 'IL', row: 2, col: 5 },
  { abbr: 'MI', row: 2, col: 6 },
  { abbr: 'NY', row: 2, col: 7 },
  { abbr: 'MA', row: 2, col: 9 },
  { abbr: 'CT', row: 2, col: 10 },
  // Row 3
  { abbr: 'OR', row: 3, col: 0 },
  { abbr: 'NV', row: 3, col: 1 },
  { abbr: 'WY', row: 3, col: 2 },
  { abbr: 'SD', row: 3, col: 3 },
  { abbr: 'IA', row: 3, col: 4 },
  { abbr: 'IN', row: 3, col: 5 },
  { abbr: 'OH', row: 3, col: 6 },
  { abbr: 'PA', row: 3, col: 7 },
  { abbr: 'NJ', row: 3, col: 8 },
  { abbr: 'RI', row: 3, col: 9 },
  // Row 4
  { abbr: 'CA', row: 4, col: 0 },
  { abbr: 'UT', row: 4, col: 1 },
  { abbr: 'CO', row: 4, col: 2 },
  { abbr: 'NE', row: 4, col: 3 },
  { abbr: 'MO', row: 4, col: 4 },
  { abbr: 'KY', row: 4, col: 5 },
  { abbr: 'WV', row: 4, col: 6 },
  { abbr: 'VA', row: 4, col: 7 },
  { abbr: 'MD', row: 4, col: 8 },
  { abbr: 'DE', row: 4, col: 9 },
  // Row 5
  { abbr: 'AZ', row: 5, col: 1 },
  { abbr: 'NM', row: 5, col: 2 },
  { abbr: 'KS', row: 5, col: 3 },
  { abbr: 'AR', row: 5, col: 4 },
  { abbr: 'TN', row: 5, col: 5 },
  { abbr: 'NC', row: 5, col: 6 },
  { abbr: 'SC', row: 5, col: 7 },
  { abbr: 'DC', row: 5, col: 8 },
  // Row 6
  { abbr: 'OK', row: 6, col: 3 },
  { abbr: 'LA', row: 6, col: 4 },
  { abbr: 'MS', row: 6, col: 5 },
  { abbr: 'AL', row: 6, col: 6 },
  { abbr: 'GA', row: 6, col: 7 },
  // Row 7
  { abbr: 'HI', row: 7, col: 0 },
  { abbr: 'TX', row: 7, col: 3 },
  { abbr: 'FL', row: 7, col: 7 },
];

const TILE_SIZE = 54;
const GAP = 4;
const CELL = TILE_SIZE + GAP;
const RADIUS = 6;
const COLS = 11;
const ROWS = 8;
const SVG_WIDTH = COLS * CELL + GAP;
const SVG_HEIGHT = ROWS * CELL + GAP;

function StateTile({ abbr, row, col, isSelected, onClick }) {
  const x = GAP + col * CELL;
  const y = GAP + row * CELL;

  const defaultFill = 'var(--slate-200)';
  const selectedFill = 'var(--navy-600)';
  const textColor = isSelected ? '#ffffff' : 'var(--slate-600)';

  return (
    <g
      style={{ cursor: 'pointer' }}
      onClick={() => onClick(abbr)}
      role="button"
      aria-label={abbr}
    >
      <rect
        x={x}
        y={y}
        width={TILE_SIZE}
        height={TILE_SIZE}
        rx={RADIUS}
        ry={RADIUS}
        fill={isSelected ? selectedFill : defaultFill}
        stroke="none"
      >
        <title>{abbr}</title>
      </rect>
      {/* Hover overlay */}
      <rect
        x={x}
        y={y}
        width={TILE_SIZE}
        height={TILE_SIZE}
        rx={RADIUS}
        ry={RADIUS}
        fill="transparent"
        stroke="none"
        className="us-map-tile-hover"
      />
      <text
        x={x + TILE_SIZE / 2}
        y={y + TILE_SIZE / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill={textColor}
        style={{
          fontSize: '13px',
          fontWeight: 600,
          fontFamily: 'inherit',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {abbr}
      </text>
    </g>
  );
}

export default function USMap({ onStateClick, selectedState }) {
  return (
    <div style={{ width: '100%', maxWidth: 660 }}>
      <style>{`
        .us-map-tile-hover:hover {
          fill: var(--navy-300);
          opacity: 0.45;
        }
      `}</style>
      <svg
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        width="100%"
        height="auto"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {STATES.map((state) => (
          <StateTile
            key={state.abbr}
            abbr={state.abbr}
            row={state.row}
            col={state.col}
            isSelected={selectedState === state.abbr}
            onClick={onStateClick}
          />
        ))}
      </svg>
    </div>
  );
}
