const crypto = require('crypto');

function base64UrlEncode(str) {
  return Buffer.from(str).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function sign(header, payload, secret) {
  const data = base64UrlEncode(JSON.stringify(header)) + '.' + base64UrlEncode(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return data + '.' + signature;
}

const header = { alg: 'HS256', typ: 'JWT' };
const payload = {
  sub: 'test-user-123',
  tenantId: 'test-tenant',
  roles: ['admin'],
  scopes: ['task:write', 'task:read'],
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600
};
const secret = 'dev-jwt-secret-for-local-testing-only-change-in-production';

console.log(sign(header, payload, secret));
