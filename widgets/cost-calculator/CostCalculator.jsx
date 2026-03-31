import React, { useState, useEffect } from 'react'
import { WidgetBase, SourceLink } from '../shared/widget-base'
import { widgetFetch, formatDollars } from '../shared/api'

export default function CostCalculatorWidget({ config }) {
  const [items, setItems] = useState([])
  const [brackets, setBrackets] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [bracketId, setBracketId] = useState('')
  const [familySize, setFamilySize] = useState(1)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const typeParam = config.type ? `&type=${encodeURIComponent(config.type)}` : ''

    Promise.all([
      widgetFetch(`/cost-calculator/items?limit=50${typeParam}`),
      widgetFetch('/cost-calculator/brackets'),
    ])
      .then(([itemsData, bracketsData]) => {
        const itemList = itemsData.items || itemsData
        const bracketList = bracketsData.brackets || bracketsData
        setItems(itemList)
        setBrackets(bracketList)
        if (bracketList.length > 0) setBracketId(bracketList[0].id)

        // Auto-select item if data-item provided
        if (config.item) {
          const match = itemList.find(
            i => i.slug === config.item || String(i.id) === config.item
          )
          if (match) setSelectedItem(match)
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [config.item, config.type])

  const handleItemChange = (e) => {
    const id = e.target.value
    const match = items.find(i => String(i.id) === id)
    setSelectedItem(match || null)
    setResult(null)
  }

  const calculate = () => {
    if (!selectedItem || !bracketId) return
    setCalculating(true)
    setResult(null)

    widgetFetch(
      `/cost-calculator/calculate?item_id=${selectedItem.id}&bracket_id=${bracketId}&family_size=${familySize}`
    )
      .then(setResult)
      .catch(err => setError(err.message))
      .finally(() => setCalculating(false))
  }

  const styles = {
    container: { minWidth: 320 },
    title: { fontSize: 16, fontWeight: 700, marginBottom: 12, color: '#1e293b' },
    field: { marginBottom: 12 },
    label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 },
    select: {
      width: '100%',
      padding: '8px 10px',
      fontSize: 13,
      border: '1px solid #cbd5e1',
      borderRadius: 6,
      background: '#fff',
      color: '#1e293b',
      outline: 'none',
    },
    input: {
      width: 80,
      padding: '8px 10px',
      fontSize: 13,
      border: '1px solid #cbd5e1',
      borderRadius: 6,
      background: '#fff',
      color: '#1e293b',
      outline: 'none',
    },
    button: {
      width: '100%',
      padding: '10px 16px',
      fontSize: 14,
      fontWeight: 600,
      color: '#fff',
      background: '#2c4a72',
      border: 'none',
      borderRadius: 6,
      cursor: 'pointer',
      opacity: (!selectedItem || !bracketId || calculating) ? 0.6 : 1,
    },
    resultBox: {
      marginTop: 16,
      background: '#fef3c7',
      border: '1px solid #fbbf24',
      borderRadius: 8,
      padding: 16,
      textAlign: 'center',
    },
    resultAmount: { fontSize: 28, fontWeight: 800, color: '#92400e' },
    resultLabel: { fontSize: 13, color: '#78350f', marginTop: 4 },
    perYear: { fontSize: 13, color: '#92400e', marginTop: 6, fontWeight: 600 },
    context: { fontSize: 12, color: '#78350f', marginTop: 8, fontStyle: 'italic' },
    itemName: { fontSize: 14, fontWeight: 600, marginBottom: 4 },
    sourceRow: { marginTop: 8, fontSize: 12, color: '#64748b' },
  }

  return (
    <WidgetBase loading={loading} error={error} config={config} widgetType="cost-calculator">
      <div style={styles.container}>
        <div style={styles.title}>What Did It Cost You?</div>

        {/* Item selector — shown if no data-item or item not found */}
        {!config.item && (
          <div style={styles.field}>
            <label style={styles.label}>Government Spending Item</label>
            <select
              style={styles.select}
              value={selectedItem ? String(selectedItem.id) : ''}
              onChange={handleItemChange}
            >
              <option value="">Select an item...</option>
              {items.map(item => (
                <option key={item.id} value={String(item.id)}>
                  {item.name} ({formatDollars(item.total_cost)})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Show selected item name when auto-loaded */}
        {config.item && selectedItem && (
          <div style={{ ...styles.field, ...styles.itemName }}>
            {selectedItem.name}
          </div>
        )}

        <div style={styles.field}>
          <label style={styles.label}>Income Bracket</label>
          <select
            style={styles.select}
            value={bracketId}
            onChange={e => { setBracketId(e.target.value); setResult(null) }}
          >
            {brackets.map(b => (
              <option key={b.id} value={b.id}>
                {b.label || b.name}
              </option>
            ))}
          </select>
        </div>

        <div style={styles.field}>
          <label style={styles.label}>Household Size</label>
          <input
            type="number"
            min={1}
            max={20}
            style={styles.input}
            value={familySize}
            onChange={e => { setFamilySize(Math.max(1, parseInt(e.target.value) || 1)); setResult(null) }}
          />
        </div>

        <button
          style={styles.button}
          onClick={calculate}
          disabled={!selectedItem || !bracketId || calculating}
        >
          {calculating ? 'Calculating...' : 'Calculate My Cost'}
        </button>

        {result && (
          <div style={styles.resultBox}>
            <div style={styles.resultAmount}>
              ${Number(result.household_cost || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div style={styles.resultLabel}>
              This cost your household
            </div>
            {result.per_year && result.years && result.years > 1 && (
              <div style={styles.perYear}>
                ${Number(result.per_year).toLocaleString(undefined, { maximumFractionDigits: 0 })} per year over {result.years} years
              </div>
            )}
            {result.national_total && (
              <div style={styles.context}>
                National total: {formatDollars(result.national_total)}
              </div>
            )}
            {selectedItem?.source_url && (
              <div style={styles.sourceRow}>
                <SourceLink value="View source" href={selectedItem.source_url} label="Cost data source" />
              </div>
            )}
          </div>
        )}
      </div>
    </WidgetBase>
  )
}
