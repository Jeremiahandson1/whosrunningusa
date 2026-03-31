import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Calculator, DollarSign, ChevronLeft, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react'
import api from '../utils/api'
import SourceCitation from '../components/SourceCitation'

const SORT_OPTIONS = [
  { value: 'cost', label: 'Highest Cost' },
  { value: 'recent', label: 'Most Recent' },
  { value: 'name', label: 'Alphabetical' },
]

function formatDollars(n) {
  if (n == null) return '$0'
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function formatHouseholdCost(n) {
  if (n == null) return '$0'
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function CostTypeBadge({ type }) {
  const colors = {
    war: { bg: '#fef2f2', color: '#b91c1c' },
    bailout: { bg: '#fefce8', color: '#92400e' },
    program: { bg: '#eff6ff', color: '#1d4ed8' },
    bill: { bg: '#f0fdf4', color: '#15803d' },
    subsidy: { bg: '#fdf4ff', color: '#86198f' },
  }
  const style = colors[type] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{ background: style.bg, color: style.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase' }}>
      {type || 'Other'}
    </span>
  )
}

function CostCalculatorPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [brackets, setBrackets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)

  // Calculator state
  const [selectedItem, setSelectedItem] = useState('')
  const [selectedBracket, setSelectedBracket] = useState('')
  const [familySize, setFamilySize] = useState(1)
  const [result, setResult] = useState(null)
  const [calculating, setCalculating] = useState(false)
  const [calcError, setCalcError] = useState(null)

  const sort = searchParams.get('sort') || 'cost'
  const page = parseInt(searchParams.get('page') || '1', 10)

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      params.set('sort', sort)

      const [itemData, bracketData] = await Promise.all([
        api.get(`/cost-calculator/items?${params.toString()}`),
        brackets.length === 0 ? api.get('/cost-calculator/brackets') : Promise.resolve(null),
      ])
      setItems(itemData.items || [])
      setTotal(itemData.total || 0)
      setTotalPages(itemData.totalPages || 1)
      if (bracketData) setBrackets(bracketData.brackets || bracketData || [])
    } catch (err) {
      setError(err.message || 'Failed to load cost data')
    } finally {
      setLoading(false)
    }
  }, [page, sort])

  useEffect(() => { fetchItems() }, [fetchItems])

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setSearchParams(next)
  }

  async function handleCalculate() {
    if (!selectedItem || !selectedBracket) return
    setCalculating(true)
    setCalcError(null)
    try {
      const data = await api.get(
        `/cost-calculator/calculate?item_id=${encodeURIComponent(selectedItem)}&bracket_id=${encodeURIComponent(selectedBracket)}&family_size=${familySize}`
      )
      setResult(data)
    } catch (err) {
      setCalcError(err.message || 'Calculation failed')
    } finally {
      setCalculating(false)
    }
  }

  function selectItemFromCard(itemId) {
    setSelectedItem(String(itemId))
    setResult(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Build items list for dropdown (we need all items for selection, not just current page)
  const [allItems, setAllItems] = useState([])
  useEffect(() => {
    api.get('/cost-calculator/items?page=1&limit=100').then(data => {
      setAllItems(data.items || [])
    }).catch(() => {})
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Hero */}
      <section style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', padding: 'clamp(48px, 8vw, 80px) 20px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 5vw, 2.75rem)', fontWeight: 800, margin: '0 0 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Calculator size={36} /> The Cost to You
        </h1>
        <p style={{ fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#94a3b8', margin: 0, maxWidth: 640, marginLeft: 'auto', marginRight: 'auto' }}>
          Every war, every bailout, every bill — what it cost your household. Not the national total. Your share.
        </p>
      </section>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 'clamp(16px, 3vw, 32px)' }}>
        {/* Calculator Card */}
        <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: 'clamp(24px, 4vw, 40px)', marginBottom: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: '0 0 24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={22} /> Calculate Your Share
          </h2>

          {/* Step 1 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Step 1: Select a government expenditure
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedItem}
                onChange={e => { setSelectedItem(e.target.value); setResult(null) }}
                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 15, color: '#1e293b', appearance: 'none', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">Choose an item...</option>
                {allItems.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({formatDollars(item.total_cost)})
                  </option>
                ))}
              </select>
              <ChevronDown size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Step 2 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Step 2: Select your income bracket
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedBracket}
                onChange={e => { setSelectedBracket(e.target.value); setResult(null) }}
                style={{ width: '100%', padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 15, color: '#1e293b', appearance: 'none', background: '#fff', cursor: 'pointer' }}
              >
                <option value="">Choose your bracket...</option>
                {brackets.map(b => (
                  <option key={b.id} value={b.id}>{b.label || b.name}</option>
                ))}
              </select>
              <ChevronDown size={18} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Step 3 */}
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Step 3: Enter family size
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={familySize}
              onChange={e => { setFamilySize(Math.max(1, parseInt(e.target.value) || 1)); setResult(null) }}
              style={{ width: 100, padding: '12px 16px', border: '2px solid #e2e8f0', borderRadius: 10, fontSize: 15, color: '#1e293b', textAlign: 'center' }}
            />
          </div>

          {/* Calculate button */}
          <button
            onClick={handleCalculate}
            disabled={!selectedItem || !selectedBracket || calculating}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              width: '100%', padding: '14px 24px', background: (!selectedItem || !selectedBracket) ? '#94a3b8' : '#1e293b',
              color: '#fff', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
              cursor: (!selectedItem || !selectedBracket) ? 'default' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {calculating ? 'Calculating...' : 'Calculate My Share'}
            {!calculating && <ArrowRight size={18} />}
          </button>

          {/* Calc Error */}
          {calcError && (
            <div style={{ marginTop: 16, padding: 16, background: '#fef2f2', borderRadius: 10, color: '#9f1239', fontSize: 14 }}>
              {calcError}
            </div>
          )}

          {/* Result */}
          {result && !calcError && (
            <div style={{ marginTop: 24, padding: 24, background: '#f0fdf4', borderRadius: 12, border: '2px solid #bbf7d0' }}>
              <div style={{ textAlign: 'center', marginBottom: 16 }}>
                <div style={{ fontSize: 14, color: '#475569', fontWeight: 500, marginBottom: 4 }}>This cost your household:</div>
                <div style={{ fontSize: 'clamp(2rem, 6vw, 3rem)', fontWeight: 900, color: '#1e293b', lineHeight: 1.1 }}>
                  {formatHouseholdCost(result.household_cost)}
                </div>
                {result.duration_years && result.duration_years > 1 && (
                  <div style={{ fontSize: 15, color: '#475569', marginTop: 8 }}>
                    That's {formatHouseholdCost(Math.round(result.household_cost / result.duration_years))} per year over {result.duration_years} years
                  </div>
                )}
              </div>

              {/* Item details */}
              <div style={{ borderTop: '1px solid #bbf7d0', paddingTop: 16, marginTop: 16 }}>
                {result.item_title && (
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#1e293b', marginBottom: 4 }}>{result.item_title}</div>
                )}
                {result.total_cost && (
                  <div style={{ fontSize: 14, color: '#475569', marginBottom: 4 }}>
                    Total national cost: <strong>{formatDollars(result.total_cost)}</strong>
                  </div>
                )}
                {result.description && (
                  <div style={{ fontSize: 14, color: '#64748b', marginBottom: 8 }}>{result.description}</div>
                )}
                {result.source_url && (
                  <div style={{ fontSize: 13 }}>
                    Source: <SourceCitation
                      value={result.source_label || 'View source'}
                      sourceUrl={result.source_url}
                      sourceLabel={result.source_label}
                      sourceDate={result.source_date}
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => { setResult(null); setSelectedItem(''); setSelectedBracket('') }}
                style={{ marginTop: 16, padding: '10px 20px', background: '#1e293b', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Explore more items
              </button>
            </div>
          )}
        </div>

        {/* Browse all items */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
              Browse All Items
            </h2>
            <select
              style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#475569' }}
              value={sort}
              onChange={e => updateFilter('sort', e.target.value)}
            >
              {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
              <div style={{ display: 'inline-block', width: 32, height: 32, border: '3px solid #e2e8f0', borderTopColor: '#1e293b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p>Loading items...</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ padding: 24, background: '#fef2f2', borderRadius: 12, color: '#9f1239', textAlign: 'center' }}>{error}</div>
          )}

          {/* Empty */}
          {!loading && !error && items.length === 0 && (
            <div style={{ textAlign: 'center', padding: 64, color: '#475569' }}>
              <Calculator size={48} color="#94a3b8" />
              <p style={{ fontSize: 18, marginTop: 12 }}>No cost items found.</p>
            </div>
          )}

          {/* Item cards */}
          {!loading && !error && items.length > 0 && (
            <>
              <div style={{ fontSize: 14, color: '#475569', marginBottom: 12 }}>{total} item{total !== 1 ? 's' : ''}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {items.map(item => (
                  <div key={item.id} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 20, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: 0, flex: 1 }}>{item.title}</h3>
                      <CostTypeBadge type={item.cost_type} />
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#1e293b', marginBottom: 4 }}>
                      {formatDollars(item.total_cost)}
                    </div>
                    {item.fiscal_year && (
                      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>FY {item.fiscal_year}</div>
                    )}
                    {item.description && (
                      <div style={{ fontSize: 13, color: '#475569', marginBottom: 12, flex: 1, lineHeight: 1.5 }}>
                        {item.description.length > 120 ? item.description.slice(0, 120) + '...' : item.description}
                      </div>
                    )}
                    <button
                      onClick={() => selectItemFromCard(item.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                        background: 'none', border: '1px solid #e2e8f0', borderRadius: 8,
                        fontSize: 13, fontWeight: 600, color: '#2563eb', cursor: 'pointer',
                        marginTop: 'auto',
                      }}
                    >
                      Calculate your share <ArrowRight size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 32, paddingBottom: 32 }}>
                  <button disabled={page <= 1} onClick={() => updateFilter('page', String(page - 1))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page <= 1 ? '#f1f5f9' : '#fff', color: page <= 1 ? '#94a3b8' : '#1e293b', cursor: page <= 1 ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span style={{ fontSize: 14, color: '#475569' }}>Page {page} of {totalPages}</span>
                  <button disabled={page >= totalPages} onClick={() => updateFilter('page', String(page + 1))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', border: '1px solid #e2e8f0', borderRadius: 8, background: page >= totalPages ? '#f1f5f9' : '#fff', color: page >= totalPages ? '#94a3b8' : '#1e293b', cursor: page >= totalPages ? 'default' : 'pointer', fontWeight: 600, fontSize: 14 }}>
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default CostCalculatorPage
