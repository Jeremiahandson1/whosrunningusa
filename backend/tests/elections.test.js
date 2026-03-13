const request = require('supertest');
const app = require('../server');
const db = require('../db');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/elections', () => {
  test('returns list of elections', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'e1', name: '2026 General Election', election_date: '2026-11-03', state: 'CA' },
        { id: 'e2', name: '2026 Primary', election_date: '2026-06-07', state: 'CA' },
      ]
    });

    const res = await request(app).get('/api/elections');
    expect(res.status).toBe(200);
    expect(res.body.elections).toHaveLength(2);
    expect(res.body.elections[0].name).toBe('2026 General Election');
  });

  test('filters by state', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/elections?state=NY');
    expect(res.status).toBe(200);
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[1]).toContain('NY');
  });

  test('filters by upcoming', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/elections?upcoming=true');
    expect(res.status).toBe(200);
    const queryStr = db.query.mock.calls[0][0];
    expect(queryStr).toContain('CURRENT_DATE');
  });

  test('returns empty array when no elections match', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/elections');
    expect(res.status).toBe(200);
    expect(res.body.elections).toEqual([]);
  });
});

describe('GET /api/elections/:id', () => {
  test('returns election with races', async () => {
    // Election query
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'e1', name: '2026 General Election', election_date: '2026-11-03' }]
    });
    // Races query
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'r1', office_name: 'U.S. Senate', office_level: 'federal', candidate_count: '3' },
        { id: 'r2', office_name: 'Governor', office_level: 'state', candidate_count: '2' },
      ]
    });

    const res = await request(app).get('/api/elections/e1');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('2026 General Election');
    expect(res.body.races).toHaveLength(2);
  });

  test('returns 404 for non-existent election', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/elections/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Election not found');
  });
});
