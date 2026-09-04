// TEMP smoke test: movement access for role mt (deleted after run)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });
const express = require('express');
const request = require('supertest');

function buildApp(roles) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.user = { id: 'sit-mt', sub: 'sit-mt', user_id: 'sit-mt', name: 'mt_user', username: 'mt_user', preferred_username: 'mt_user', roles, realm_access: { roles } };
    next();
  });
  app.use('/api/reagen', require('./routes/reagen'));
  app.use('/api/persediaan', require('./routes/persediaan'));
  app.use('/api/glassware', require('./routes/glassware'));
  return app;
}
const ok = (name, cond, extra = '') => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`); if (!cond) process.exitCode = 1; };

(async () => {
  const mtApp = buildApp(['mt']);
  const katimApp = buildApp(['katim']);
  try {
    let r = await request(mtApp).get('/api/persediaan/movement');
    ok('ATK movement oleh mt -> 200', r.status === 200, `status=${r.status}`);

    r = await request(mtApp).get('/api/reagen/reagen/movement');
    ok('Reagen movement oleh mt -> 200', r.status === 200, `status=${r.status}`);

    r = await request(mtApp).get('/api/glassware/movement').query({ lab: 1, jenis: 1 });
    ok('Glassware movement oleh mt -> 200', r.status === 200, `status=${r.status}`);

    r = await request(katimApp).get('/api/glassware/movement').query({ lab: 1, jenis: 1 });
    ok('Glassware movement oleh katim -> 403', r.status === 403, `status=${r.status}`);
  } finally {
    process.exit(process.exitCode || 0);
  }
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
