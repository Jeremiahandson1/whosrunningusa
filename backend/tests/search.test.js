const request = require('supertest');
const app = require('../server');
const db = require('../db');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/search', () => {
  test('returns search results across all types', async () => {
    // Candidates search
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c1', display_name: 'Alice Smith', result_type: 'candidate' }]
    });
    // Races search
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', name: 'Senate Race', result_type: 'race' }]
    });
    // Elections search
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'e1', name: '2026 General', result_type: 'election' }]
    });

    const res = await request(app).get('/api/search?q=alice');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.races).toHaveLength(1);
    expect(res.body.elections).toHaveLength(1);
  });

  test('rejects query shorter than 2 characters', async () => {
    const res = await request(app).get('/api/search?q=a');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Search query must be at least 2 characters');
  });

  test('rejects missing query', async () => {
    const res = await request(app).get('/api/search');
    expect(res.status).toBe(400);
  });

  test('filters by type=candidates', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c1', display_name: 'Alice Smith', result_type: 'candidate' }]
    });

    const res = await request(app).get('/api/search?q=alice&type=candidates');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
    expect(res.body.races).toEqual([]);
    expect(res.body.elections).toEqual([]);
    // Only one query should be made (candidates only)
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('filters by type=races', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'r1', name: 'Senate Race', result_type: 'race' }]
    });

    const res = await request(app).get('/api/search?q=senate&type=races');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([]);
    expect(res.body.races).toHaveLength(1);
    expect(res.body.elections).toEqual([]);
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('returns empty results when nothing matches', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [] });
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/search?q=zzzzzzzzz');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([]);
    expect(res.body.races).toEqual([]);
    expect(res.body.elections).toEqual([]);
  });
});

describe('GET /api/search/candidates/by-location', () => {
  test('returns candidates by state', async () => {
    db.query.mockResolvedValueOnce({
      rows: [
        { id: 'c1', display_name: 'Alice Smith', office_level: 'state', office_name: 'Governor' },
        { id: 'c2', display_name: 'Bob Jones', office_level: 'federal', office_name: 'U.S. Senate' },
      ]
    });

    const res = await request(app).get('/api/search/candidates/by-location?state=CA');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(2);
  });

  test('returns candidates by state and county', async () => {
    db.query.mockResolvedValueOnce({
      rows: [{ id: 'c1', display_name: 'Alice Smith', office_level: 'local', office_name: 'City Council' }]
    });

    const res = await request(app).get('/api/search/candidates/by-location?state=CA&county=Los%20Angeles');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toHaveLength(1);
  });

  test('returns empty list when no candidates in location', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/search/candidates/by-location?state=ZZ');
    expect(res.status).toBe(200);
    expect(res.body.candidates).toEqual([]);
  });

  test('filters by officeLevel', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });

    const res = await request(app).get('/api/search/candidates/by-location?state=CA&officeLevel=federal');
    expect(res.status).toBe(200);
    const callArgs = db.query.mock.calls[0];
    expect(callArgs[1]).toContain('federal');
  });
});
