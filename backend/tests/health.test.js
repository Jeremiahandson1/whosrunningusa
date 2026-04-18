const request = require('supertest');
const app = require('../server');

describe('Health check', () => {
  test('GET /api/health returns status + timestamp + db field', async () => {
    const res = await request(app).get('/api/health');
    // 200 when DB is reachable, 503 when it's not — both are valid outcomes
    expect([200, 503]).toContain(res.status);
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body.timestamp).toBeDefined();
    expect(res.body.db).toBeDefined();
  });

  test('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
