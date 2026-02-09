/**
 * K6 Full Test - Register a new user then load test login
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
    setupTimeout: '120s',
    scenarios: {
        load_test: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS) || 100,
            duration: __ENV.DURATION || '30s',
        },
    },
    thresholds: {
        'login_latency_ms': ['p(95)<3000', 'p(99)<5000'],
        'error_rate': ['rate<0.10'],
    },
};

// Unique test ID
const TEST_ID = `${Date.now()}`;
const TEST_TENANT = 'tenant-1';
const TEST_EMAIL = `k6test${TEST_ID}@example.com`;
const TEST_PASSWORD = 'K6Test@123456';

const registerMutation = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      success
      message
      user {
        id
        email
        status
      }
    }
  }
`;

const loginMutation = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user {
        id
        email
        status
      }
      tokens {
        accessToken
        refreshToken
        expiresIn
      }
    }
  }
`;

export function setup() {
    console.log('\n========================================');
    console.log('K6 USER SERVICE LOAD TEST');
    console.log('========================================');
    console.log(`Endpoint: ${GRAPHQL_ENDPOINT}`);
    console.log(`Test Email: ${TEST_EMAIL}`);
    console.log(`Test Password: ${TEST_PASSWORD}`);
    console.log('');

    // Step 1: Register new user
    console.log('Step 1: Registering new test user...');
    const registerPayload = {
        query: registerMutation,
        variables: {
            input: {
                tenantId: TEST_TENANT,
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                firstName: 'K6',
                lastName: 'LoadTest',
            }
        }
    };

    const regResponse = http.post(GRAPHQL_ENDPOINT, JSON.stringify(registerPayload), {
        headers: { 'Content-Type': 'application/json' },
    });

    console.log(`Register Status: ${regResponse.status}`);

    let regBody;
    try {
        regBody = JSON.parse(regResponse.body);
    } catch (e) {
        console.log(`ERROR parsing register response: ${e.message}`);
        console.log(`Raw body: ${regResponse.body.substring(0, 500)}`);
        return { ok: false, error: 'Parse error' };
    }

    if (regBody.errors) {
        console.log(`Register Error: ${regBody.errors[0]?.message}`);
        // Continue anyway - user might already exist
    } else if (regBody.data?.register?.success) {
        console.log(`Register Success! User ID: ${regBody.data.register.user?.id}`);
    }

    // Step 2: Test login with new user
    console.log('\nStep 2: Testing login with new user...');
    const loginPayload = {
        query: loginMutation,
        variables: {
            input: {
                tenantId: TEST_TENANT,
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
            }
        }
    };

    const loginResponse = http.post(GRAPHQL_ENDPOINT, JSON.stringify(loginPayload), {
        headers: { 'Content-Type': 'application/json' },
    });

    console.log(`Login Status: ${loginResponse.status}`);

    let loginBody;
    try {
        loginBody = JSON.parse(loginResponse.body);
    } catch (e) {
        console.log(`ERROR parsing login response: ${e.message}`);
        console.log(`Raw body: ${loginResponse.body.substring(0, 500)}`);
        return { ok: false, error: 'Login parse error' };
    }

    if (loginBody.errors) {
        console.log(`Login Error: ${loginBody.errors[0]?.message}`);
        return {
            ok: false,
            error: loginBody.errors[0]?.message,
            tenantId: TEST_TENANT,
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        };
    }

    const hasUser = !!loginBody.data?.login?.user?.id;
    const hasTokens = !!loginBody.data?.login?.tokens?.accessToken;

    console.log(`Has User: ${hasUser}`);
    console.log(`Has Tokens: ${hasTokens}`);

    if (hasUser && hasTokens) {
        console.log(`\n✓ SETUP SUCCESS - User: ${loginBody.data.login.user.email}`);
        console.log('========================================\n');
        return {
            ok: true,
            tenantId: TEST_TENANT,
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            userId: loginBody.data.login.user.id,
        };
    } else {
        console.log('\n✗ SETUP FAILED - Login did not return expected data');
        console.log(`Response: ${JSON.stringify(loginBody).substring(0, 500)}`);
        return {
            ok: false,
            error: 'Invalid login response',
            tenantId: TEST_TENANT,
            email: TEST_EMAIL,
            password: TEST_PASSWORD
        };
    }
}

export default function (data) {
    if (!data.ok) {
        // Still run the test to measure latency even if setup failed
    }

    const startTime = Date.now();

    const response = http.post(GRAPHQL_ENDPOINT, JSON.stringify({
        query: loginMutation,
        variables: {
            input: {
                tenantId: data.tenantId,
                email: data.email,
                password: data.password,
            }
        }
    }), {
        headers: { 'Content-Type': 'application/json' },
    });

    const duration = Date.now() - startTime;
    loginLatency.add(duration);

    let body;
    try {
        body = JSON.parse(response.body);
    } catch (e) {
        if (__ITER < 3) console.log(`[VU${__VU}] Parse error: ${e.message}`);
        failedLogins.add(1);
        errorRate.add(1);
        return;
    }

    // Debug first 3 responses per VU
    if (__ITER < 2 && __VU <= 3) {
        const hasErr = !!body.errors;
        const hasData = !!body.data?.login;
        console.log(`[VU${__VU}:${__ITER}] ${response.status} | data=${hasData} | err=${hasErr} | ${duration}ms`);
        if (hasErr) {
            console.log(`[VU${__VU}] Error: ${body.errors[0]?.message?.substring(0, 80)}`);
        }
    }

    const hasUser = body.data?.login?.user?.id;
    const hasTokens = body.data?.login?.tokens?.accessToken;
    const noErrors = !body.errors;

    const success = check(response, {
        'status is 200': (r) => r.status === 200,
        'has user data': () => !!hasUser,
        'has tokens': () => !!hasTokens,
        'no errors': () => noErrors,
    });

    if (success) {
        successfulLogins.add(1);
        errorRate.add(0);
    } else {
        failedLogins.add(1);
        errorRate.add(1);
    }

    sleep(0.1);
}

export function handleSummary(data) {
    const metrics = data.metrics;
    const p95 = metrics.login_latency_ms?.values['p(95)']?.toFixed(0) || 'N/A';
    const p99 = metrics.login_latency_ms?.values['p(99)']?.toFixed(0) || 'N/A';
    const avg = metrics.login_latency_ms?.values['avg']?.toFixed(0) || 'N/A';
    const max = metrics.login_latency_ms?.values['max']?.toFixed(0) || 'N/A';
    const min = metrics.login_latency_ms?.values['min']?.toFixed(0) || 'N/A';
    const successCount = metrics.successful_logins?.values.count || 0;
    const failCount = metrics.failed_logins?.values.count || 0;
    const totalReqs = metrics.http_reqs?.values.count || 0;
    const successRate = totalReqs > 0 ? ((successCount / (successCount + failCount)) * 100).toFixed(1) : '0';

    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║          USER SERVICE LOAD TEST RESULTS              ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║ Total Requests:       ${String(totalReqs).padStart(8)} requests          ║`);
    console.log(`║ Successful Logins:    ${String(successCount).padStart(8)}                    ║`);
    console.log(`║ Failed Logins:        ${String(failCount).padStart(8)}                    ║`);
    console.log(`║ Success Rate:         ${String(successRate).padStart(7)}%                    ║`);
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log('║ LATENCY METRICS (milliseconds)                       ║');
    console.log(`║   Minimum:            ${String(min).padStart(8)} ms                 ║`);
    console.log(`║   Average:            ${String(avg).padStart(8)} ms                 ║`);
    console.log(`║   P95:                ${String(p95).padStart(8)} ms                 ║`);
    console.log(`║   P99:                ${String(p99).padStart(8)} ms                 ║`);
    console.log(`║   Maximum:            ${String(max).padStart(8)} ms                 ║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');

    return {
        'scripts/k6/login-summary.json': JSON.stringify(data, null, 2),
    };
}
