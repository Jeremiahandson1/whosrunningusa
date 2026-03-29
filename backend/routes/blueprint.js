const express = require('express');
const router = express.Router();

// GET /api/blueprint/debt — real national debt from US Treasury
let debtCache = { data: null, fetchedAt: 0 };
const DEBT_CACHE_MS = 3600_000; // 1 hour

router.get('/debt', async (req, res) => {
  if (debtCache.data && Date.now() - debtCache.fetchedAt < DEBT_CACHE_MS) {
    return res.json(debtCache.data);
  }
  try {
    const resp = await fetch('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page%5Bsize%5D=1');
    if (!resp.ok) throw new Error('Treasury API error');
    const json = await resp.json();
    const row = json.data[0];
    debtCache.data = {
      totalDebt: parseFloat(row.tot_pub_debt_out_amt),
      publicDebt: parseFloat(row.debt_held_public_amt),
      intragovDebt: parseFloat(row.intragov_hold_amt),
      asOf: row.record_date,
    };
    debtCache.fetchedAt = Date.now();
    res.json(debtCache.data);
  } catch (err) {
    console.error('Treasury API error:', err.message);
    // Fallback to known recent value
    res.json({
      totalDebt: 38990389667489.38,
      publicDebt: 31361115540758.11,
      intragovDebt: 7629274126731.27,
      asOf: '2026-03-26',
      cached: true,
    });
  }
});

// POST /api/blueprint/ask — Anthropic API proxy for policy chatbot
router.post('/ask', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { message, profile } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }

  const systemPrompt = `You are a helpful, non-partisan policy advisor for Jeremiah Phillips' campaign platform. You explain policy proposals clearly using plain language. When the user has shared profile information, reference their specific numbers to show how policies would affect them personally.

The platform has 41 chapters covering:
- Tax Reform (Ch 8): 0% income tax, 0% payroll tax, 27% NST on non-essentials, 1% FTT, wealth tax >$11M
- Property Tax Abolition (Ch 32): 5-year phase-out to $0, petty fees eliminated
- National Debt (Ch 2, 39): $39T debt, 30-year elimination through surplus, FAO oversight
- Veterans (Ch 22): $400/month per year served, means-tested, automatic deposit
- Seniors (Ch 25): Senior UBI at MIT Living Wage floor (~$2,450/mo at full implementation), strict means-testing
- Healthcare (Ch 6): Free at point of access, no premiums/copays/deductibles
- Banking (Ch 16): 15% rate cap, Glass-Steagall, break up too-big-to-fail
- Housing (Ch 26): Corporate ownership banned, 5 investment property limit
- Military (Ch 4): $960B to $550B, zero cuts to personnel, competitive bidding
- Drug Policy (Ch 27): Natural substances legalized, synthetics decriminalized, Switzerland clinical model
- Education (Ch 7): Equal per-student funding, administrator salary reform, 7% admin overhead ceiling
- American Coverage System (Ch 17): Universal coverage for health, auto, home, life, disability, title. FEMA eliminated.
- Government Reform (Ch 10): Lifetime lobbying ban, lobbying location requirement, term limits
- Criminal Justice (Ch 14): End private prisons, end qualified immunity, statutes of limitations eliminated
- Corporate Accountability (Ch 37): Profit + 10% penalty, personal criminal liability
- Transparency & AEGIS (Ch 33-34): OpenLedger, CivicSignal, WhosRunningUSA, AEGIS AI monitoring
- American Public University System (Ch 40): Free tuition, consolidation pays for it
- National Skills Certification (Ch 41): Competency-based credentials, school name irrelevant
- Plus: Immigration, Small Business, Agriculture, Tech/AI/Space, Foreign Policy, Environment, Community Infrastructure, Democracy Reform, Consumer Protection, Federal Reserve Reform, and more

Always be factual about the proposals. If you don't know something, say so. Keep answers concise but thorough.`;

  let profileContext = '';
  if (profile && typeof profile === 'object') {
    const fields = [];
    if (profile.income) fields.push(`Income: $${Number(profile.income).toLocaleString()}`);
    if (profile.filingStatus) fields.push(`Filing: ${profile.filingStatus}`);
    if (profile.age) fields.push(`Age: ${profile.age}`);
    if (profile.householdSize) fields.push(`Household: ${profile.householdSize}`);
    if (profile.veteranStatus) fields.push(`Veteran: ${profile.veteranStatus}`);
    if (profile.yearsServed) fields.push(`Years served: ${profile.yearsServed}`);
    if (profile.propertyTax) fields.push(`Property tax: $${Number(profile.propertyTax).toLocaleString()}`);
    if (profile.healthcareCosts) fields.push(`Healthcare costs: $${Number(profile.healthcareCosts).toLocaleString()}/yr`);
    if (profile.monthlySpending) fields.push(`Non-essential spending: $${Number(profile.monthlySpending).toLocaleString()}/mo`);
    if (profile.netWorth) fields.push(`Net worth: $${Number(profile.netWorth).toLocaleString()}`);
    if (profile.tradesPerYear) fields.push(`Trades/year: ${profile.tradesPerYear}`);
    if (profile.housingSituation) fields.push(`Housing: ${profile.housingSituation}`);
    if (profile.debtBalances) fields.push(`Debt balances: ${profile.debtBalances}`);
    if (profile.debtRates) fields.push(`Debt rates: ${profile.debtRates}`);
    if (fields.length) {
      profileContext = `\n\nUser profile:\n${fields.join('\n')}`;
    }
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt + profileContext,
        messages: [{ role: 'user', content: message }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', err);
      return res.status(502).json({ error: 'AI service error' });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || 'No response generated.';
    res.json({ answer: text });
  } catch (err) {
    console.error('Blueprint API proxy error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
