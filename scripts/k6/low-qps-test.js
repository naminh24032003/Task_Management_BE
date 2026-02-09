/**
 * K6 Low QPS Test - 10-15 requests per second
 * Purpose: Verify metrics (p95, p99) are visible in Grafana
 *
 * Run on minikube:
 *   1) Get Kong proxy URL:
 *      minikube service kong-kong-proxy -n kong --url
 *      (hoặc kubectl port-forward -n kong svc/kong-kong-proxy 30080:80)
 *
 *   2) Run test:
 *      k6 run scripts/k6/low-qps-test.js -e BASE_URL=http://<MINIKUBE_IP>:30080
 *
 *   3) (Optional) Push k6 metrics to Prometheus for Grafana:
 *      k6 run --out experimental-prometheus-rw scripts/k6/low-qps-test.js \
 *        -e BASE_URL=http://<MINIKUBE_IP>:30080 \
 *        -e K6_PROMETHEUS_RW_SERVER_URL=http://localhost:9090/api/v1/write
 *      (requires: kubectl port-forward -n monitoring svc/monitoring-kube-prometheus-prometheus 9090:9090)
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics
const loginLatency = new Trend('login_latency_ms');
const errorRate = new Rate('error_rate');
const successfulLogins = new Counter('successful_logins');
const failedLogins = new Counter('failed_logins');

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`;

// Target: 10-15 QPS using constant-arrival-rate
export const options = {
    setupTimeout: '120s',
    summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(50)', 'p(90)', 'p(95)', 'p(99)'],
    scenarios: {
        constant_qps_test: {
            executor: 'constant-arrival-rate',
            rate: parseInt(__ENV.QPS) || 2,    // 2 req/s default for minikube (bcrypt CPU heavy). Use -e QPS=10 for real clusters
            timeUnit: '1s',
            duration: __ENV.DURATION || '90s', // 90s → ~900 requests → đủ data cho p95/p99
            preAllocatedVUs: 50,               // Tăng từ 20 → 50 (pre-warm)
            maxVUs: 200,                       // Tăng từ 50 → 200 (CRITICAL: cần đủ VU cho slow responses)
            gracefulStop: '30s',               // Cho phép in-flight requests hoàn thành
        },
    },
    thresholds: {
        'login_latency_ms': ['p(95)<5000', 'p(99)<8000'],  // Relaxed cho minikube
        'error_rate': ['rate<0.10'],
        // Chỉ đo requests trong scenario (loại trừ setup requests)
        'http_req_duration{scenario:constant_qps_test}': ['p(95)<5000', 'p(99)<8000'],
    },
};

// Test credentials
const TEST_ID = `${Date.now()}`;
const TEST_TENANT = 'tenant-1';
const TEST_EMAIL = `k6lowqps${TEST_ID}@example.com`;
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

const TARGET_QPS = parseInt(__ENV.QPS) || 2;
const TEST_DURATION = __ENV.DURATION || '90s';

export function setup() {
    console.log('\n========================================');
    console.log('K6 LOW QPS TEST (10-15 rps)');
    console.log('========================================');
    console.log(`Endpoint: ${GRAPHQL_ENDPOINT}`);
    console.log(`Target QPS: ${TARGET_QPS}`);
    console.log(`Duration: ${TEST_DURATION}`);
    console.log(`Test Email: ${TEST_EMAIL}`);
    console.log('');

    // Step 1: Register new user
    console.log('Step 1: Registering test user...');
    const registerPayload = {
        query: registerMutation,
        variables: {
            input: {
                tenantId: TEST_TENANT,
                email: TEST_EMAIL,
                password: TEST_PASSWORD,
                firstName: 'K6LowQPS',
                lastName: 'Test',
            }
        }
    };

    const regResponse = http.post(GRAPHQL_ENDPOINT, JSON.stringify(registerPayload), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '60s',
        tags: { name: 'setup_register' },
    });

    console.log(`Register Status: ${regResponse.status}`);

    if (!regResponse.body) {
        console.log('ERROR: Empty register response (connection failed or timeout)');
        return { ok: false, error: 'Empty response' };
    }

    let regBody;
    try {
        regBody = JSON.parse(regResponse.body);
    } catch (e) {
        console.log(`ERROR parsing register response: ${e.message}`);
        console.log(`Raw body: ${regResponse.body?.substring(0, 300)}`);
        return { ok: false, error: 'Parse error' };
    }

    if (regBody.errors) {
        console.log(`Register Error: ${regBody.errors[0]?.message}`);
    } else if (regBody.data?.register?.success) {
        console.log(`Register Success! User ID: ${regBody.data.register.user?.id}`);
    }

    // Step 2: Test login
    console.log('\nStep 2: Verifying login...');
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
        timeout: '60s',
        tags: { name: 'setup_verify_login' },
    });

    console.log(`Login Status: ${loginResponse.status}`);

    let loginBody;
    try {
        loginBody = JSON.parse(loginResponse.body);
    } catch (e) {
        console.log(`ERROR parsing login response: ${e.message}`);
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

    if (hasUser && hasTokens) {
        console.log(`\n✓ SETUP SUCCESS - Ready for ${TARGET_QPS} QPS test`);
        console.log('========================================\n');
        return {
            ok: true,
            tenantId: TEST_TENANT,
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            userId: loginBody.data.login.user.id,
        };
    } else {
        console.log('\n✗ SETUP FAILED');
        return { ok: false, error: 'Invalid login response' };
    }
}

export default function (data) {
    if (!data.ok) {
        failedLogins.add(1);
        errorRate.add(1);
        return;
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
        timeout: '30s',
        tags: { name: 'login_test' },
    });

    const duration = Date.now() - startTime;
    loginLatency.add(duration);

    if (!response.body) {
        failedLogins.add(1);
        errorRate.add(1);
        return;
    }

    let body;
    try {
        body = JSON.parse(response.body);
    } catch (e) {
        failedLogins.add(1);
        errorRate.add(1);
        return;
    }

    // Debug first few responses
    if (__ITER < 3) {
        const hasErr = !!body.errors;
        const hasData = !!body.data?.login;
        console.log(`[Iter ${__ITER}] ${response.status} | data=${hasData} | err=${hasErr} | ${duration}ms`);
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
}

export function handleSummary(data) {
    const metrics = data.metrics;

    // Login latency metrics
    const loginP50 = metrics.login_latency_ms?.values['p(50)']?.toFixed(0) || 'N/A';
    const loginP90 = metrics.login_latency_ms?.values['p(90)']?.toFixed(0) || 'N/A';
    const loginP95 = metrics.login_latency_ms?.values['p(95)']?.toFixed(0) || 'N/A';
    const loginP99 = metrics.login_latency_ms?.values['p(99)']?.toFixed(0) || 'N/A';
    const loginAvg = metrics.login_latency_ms?.values['avg']?.toFixed(0) || 'N/A';
    const loginMax = metrics.login_latency_ms?.values['max']?.toFixed(0) || 'N/A';
    const loginMin = metrics.login_latency_ms?.values['min']?.toFixed(0) || 'N/A';

    // HTTP metrics (includes setup requests too)
    const httpP50 = metrics.http_req_duration?.values['p(50)']?.toFixed(0) || 'N/A';
    const httpP90 = metrics.http_req_duration?.values['p(90)']?.toFixed(0) || 'N/A';
    const httpP95 = metrics.http_req_duration?.values['p(95)']?.toFixed(0) || 'N/A';
    const httpP99 = metrics.http_req_duration?.values['p(99)']?.toFixed(0) || 'N/A';
    const httpAvg = metrics.http_req_duration?.values['avg']?.toFixed(0) || 'N/A';

    const successCount = metrics.successful_logins?.values?.count || 0;
    const failCount = metrics.failed_logins?.values?.count || 0;
    const totalReqs = metrics.http_reqs?.values?.count || 0;
    const rps = metrics.http_reqs?.values?.rate?.toFixed(2) || '0';
    const successRate = (successCount + failCount) > 0
        ? ((successCount / (successCount + failCount)) * 100).toFixed(1)
        : '0';

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║            K6 LOW QPS TEST RESULTS (10-15 rps)               ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║ Total HTTP Requests:   ${String(totalReqs).padStart(10)}                        ║`);
    console.log(`║ Actual RPS:            ${String(rps).padStart(10)} req/s                   ║`);
    console.log(`║ Successful Logins:     ${String(successCount).padStart(10)}                        ║`);
    console.log(`║ Failed Logins:         ${String(failCount).padStart(10)}                        ║`);
    console.log(`║ Success Rate:          ${String(successRate).padStart(9)}%                        ║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║ LOGIN LATENCY METRICS (ms) - These appear in Grafana        ║');
    console.log(`║   Min:                 ${String(loginMin).padStart(10)} ms                      ║`);
    console.log(`║   Avg:                 ${String(loginAvg).padStart(10)} ms                      ║`);
    console.log(`║   P50 (median):        ${String(loginP50).padStart(10)} ms                      ║`);
    console.log(`║   P90:                 ${String(loginP90).padStart(10)} ms                      ║`);
    console.log(`║   P95:                 ${String(loginP95).padStart(10)} ms  ← Check Grafana     ║`);
    console.log(`║   P99:                 ${String(loginP99).padStart(10)} ms  ← Check Grafana     ║`);
    console.log(`║   Max:                 ${String(loginMax).padStart(10)} ms                      ║`);
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log('║ HTTP REQUEST DURATION (ms) - All HTTP requests              ║');
    console.log(`║   Avg:                 ${String(httpAvg).padStart(10)} ms                      ║`);
    console.log(`║   P50:                 ${String(httpP50).padStart(10)} ms                      ║`);
    console.log(`║   P90:                 ${String(httpP90).padStart(10)} ms                      ║`);
    console.log(`║   P95:                 ${String(httpP95).padStart(10)} ms                      ║`);
    console.log(`║   P99:                 ${String(httpP99).padStart(10)} ms                      ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    return {
        'scripts/k6/low-qps-summary.json': JSON.stringify(data, null, 2),
    };
}
