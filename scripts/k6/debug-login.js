/**
 * K6 Debug Test - Check actual response structure
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

const loginLatency = new Trend('login_latency_ms');
const errorRate = new Rate('error_rate');
const successfulLogins = new Counter('successful_logins');
const failedLogins = new Counter('failed_logins');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`;

export const options = {
    scenarios: {
        debug_test: {
            executor: 'constant-vus',
            vus: 1,
            duration: '5s',
        },
    },
};

const loginQuery = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user {
        id
        email
      }
      tokens {
        accessToken
        expiresIn
      }
    }
  }
`;

const TEST_TENANT_ID = 'tenant-1';
const TEST_EMAIL = 'naminh240320631@gmail.com';
const TEST_PASSWORD = 'Minhminh123.';

export default function () {
    const startTime = Date.now();

    const response = http.post(GRAPHQL_ENDPOINT, JSON.stringify({
        query: loginQuery,
        variables: {
            input: {
                tenantId: TEST_TENANT_ID,
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
            }
        }
    }), {
        headers: { 'Content-Type': 'application/json' },
    });

    const duration = Date.now() - startTime;
    loginLatency.add(duration);

    // Log first 5 responses in full detail
    if (__ITER < 5) {
        console.log(`\n=== Response ${__ITER} ===`);
        console.log(`Status: ${response.status}`);
        console.log(`Body: ${response.body}`);

        try {
            const body = JSON.parse(response.body);
            console.log(`Has data: ${!!body.data}`);
            console.log(`Has data.login: ${!!body.data?.login}`);
            console.log(`Has errors: ${!!body.errors}`);
            if (body.errors) {
                console.log(`Errors: ${JSON.stringify(body.errors)}`);
            }
            if (body.data?.login) {
                console.log(`User ID: ${body.data.login.user?.id}`);
                console.log(`Has tokens: ${!!body.data.login.tokens}`);
            }
        } catch (e) {
            console.log(`Parse error: ${e.message}`);
        }
    }

    let body;
    try {
        body = JSON.parse(response.body);
    } catch (e) {
        failedLogins.add(1);
        errorRate.add(1);
        return;
    }

    const hasLogin = body.data && body.data.login;
    const hasUser = hasLogin && body.data.login.user && body.data.login.user.id;
    const hasTokens = hasLogin && body.data.login.tokens && body.data.login.tokens.accessToken;
    const noErrors = !body.errors;

    if (hasUser && hasTokens && noErrors) {
        successfulLogins.add(1);
        errorRate.add(0);
    } else {
        failedLogins.add(1);
        errorRate.add(1);
    }

    sleep(0.5);
}
