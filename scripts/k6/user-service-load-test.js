/**
 * K6 Load Test for User Service
 * 
 * This script tests the user-service endpoints through BFF GraphQL
 * to verify:
 * 1. Race condition handling under concurrent load
 * 2. P95, P99 latency metrics
 * 
 * Usage:
 *   k6 run scripts/k6/user-service-load-test.js
 * 
 * Environment variables:
 *   - BASE_URL: The base URL for the API (default: http://localhost:8000)
 *   - VUS: Number of virtual users (default: 100)
 *   - DURATION: Test duration (default: 30s)
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';

// Custom metrics
const loginLatency = new Trend('login_latency_ms');
const meQueryLatency = new Trend('me_query_latency_ms');
const userQueryLatency = new Trend('user_query_latency_ms');
const refreshTokenLatency = new Trend('refresh_token_latency_ms');
const errorRate = new Rate('error_rate');
const successfulRequests = new Counter('successful_requests');
const failedRequests = new Counter('failed_requests');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:8000';
const GRAPHQL_ENDPOINT = `${BASE_URL}/graphql`;

// Test options - 100 concurrent virtual users
export const options = {
    scenarios: {
        concurrent_load: {
            executor: 'constant-vus',
            vus: parseInt(__ENV.VUS) || 100,
            duration: __ENV.DURATION || '30s',
        },
    },
    thresholds: {
        // P95 should be under 500ms
        'me_query_latency_ms': ['p(95)<500', 'p(99)<1000'],
        'user_query_latency_ms': ['p(95)<500', 'p(99)<1000'],
        'login_latency_ms': ['p(95)<1000', 'p(99)<2000'],
        'refresh_token_latency_ms': ['p(95)<500', 'p(99)<1000'],
        'error_rate': ['rate<0.05'], // Less than 5% error rate
        'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    },
};

// GraphQL Queries and Mutations
const queries = {
    login: `
    mutation Login($input: LoginInput!) {
      login(input: $input) {
        user {
          id
          email
          firstName
          lastName
          status
        }
        tokens {
          accessToken
          refreshToken
          expiresIn
        }
      }
    }
  `,
    me: `
    query Me {
      me {
        id
        email
        firstName
        lastName
        displayName
        status
        roleIds
        createdAt
        updatedAt
        lastLoginAt
      }
    }
  `,
    user: `
    query User($id: String!) {
      user(id: $id) {
        id
        email
        firstName
        lastName
        displayName
        status
        roleIds
        createdAt
        updatedAt
      }
    }
  `,
    refreshToken: `
    mutation RefreshToken($refreshToken: String!) {
      refreshToken(refreshToken: $refreshToken) {
        accessToken
        refreshToken
        expiresIn
      }
    }
  `,
};

// Test data - use test users that exist in your system
const TEST_TENANT_ID = 'default-tenant';
const TEST_EMAIL = 'test123@example.com';
const TEST_PASSWORD = 'Test123!';

// Helper function to make GraphQL requests
function graphqlRequest(query, variables, accessToken = null) {
    const headers = {
        'Content-Type': 'application/json',
    };

    if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const payload = JSON.stringify({
        query: query,
        variables: variables,
    });

    return http.post(GRAPHQL_ENDPOINT, payload, { headers });
}

// Setup function - run once before all VUs
export function setup() {
    console.log(`Starting load test against ${BASE_URL}`);
    console.log(`GraphQL endpoint: ${GRAPHQL_ENDPOINT}`);

    // First, register a test user (ignore if already exists)
    const registerQuery = `
    mutation Register($input: RegisterInput!) {
      register(input: $input) {
        user { id email }
        success
        message
      }
    }
  `;

    const registerResponse = graphqlRequest(registerQuery, {
        input: {
            tenantId: TEST_TENANT_ID,
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
            firstName: 'Load',
            lastName: 'Test',
        }
    });

    console.log('Register response:', registerResponse.body);

    // Login to get initial tokens
    const loginResponse = graphqlRequest(queries.login, {
        input: {
            tenantId: TEST_TENANT_ID,
            email: TEST_EMAIL,
            password: TEST_PASSWORD,
        }
    });

    const loginData = JSON.parse(loginResponse.body);

    if (loginData.errors) {
        console.error('Login failed:', JSON.stringify(loginData.errors));
        // Try to continue anyway - some tests might work
        return { accessToken: null, refreshToken: null, userId: null };
    }

    const tokens = loginData.data?.login?.tokens;
    const userId = loginData.data?.login?.user?.id;

    console.log(`Setup complete. User ID: ${userId}`);

    return {
        accessToken: tokens?.accessToken,
        refreshToken: tokens?.refreshToken,
        userId: userId,
    };
}

// Main test function - run by each VU
export default function (data) {
    const { accessToken, refreshToken, userId } = data;

    if (!accessToken) {
        console.error('No access token available, skipping authenticated tests');

        // Still test login endpoint
        group('Login (unauthenticated)', () => {
            const startTime = Date.now();
            const response = graphqlRequest(queries.login, {
                input: {
                    tenantId: TEST_TENANT_ID,
                    email: TEST_EMAIL,
                    password: TEST_PASSWORD,
                }
            });
            const duration = Date.now() - startTime;
            loginLatency.add(duration);

            const success = check(response, {
                'login status is 200': (r) => r.status === 200,
                'login response has data': (r) => {
                    const body = JSON.parse(r.body);
                    return body.data?.login?.user?.id !== undefined;
                },
            });

            if (success) {
                successfulRequests.add(1);
                errorRate.add(0);
            } else {
                failedRequests.add(1);
                errorRate.add(1);
            }
        });

        sleep(0.1);
        return;
    }

    // Test 1: Get current user (me query)
    group('Me Query', () => {
        const startTime = Date.now();
        const response = graphqlRequest(queries.me, {}, accessToken);
        const duration = Date.now() - startTime;
        meQueryLatency.add(duration);

        const success = check(response, {
            'me status is 200': (r) => r.status === 200,
            'me response has data': (r) => {
                const body = JSON.parse(r.body);
                return body.data?.me?.id !== undefined;
            },
            'me response has no errors': (r) => {
                const body = JSON.parse(r.body);
                return !body.errors;
            },
        });

        if (success) {
            successfulRequests.add(1);
            errorRate.add(0);
        } else {
            failedRequests.add(1);
            errorRate.add(1);
            console.log('Me query failed:', response.body);
        }
    });

    // Small pause between requests
    sleep(0.05);

    // Test 2: Get user by ID
    if (userId) {
        group('User Query by ID', () => {
            const startTime = Date.now();
            const response = graphqlRequest(queries.user, { id: userId }, accessToken);
            const duration = Date.now() - startTime;
            userQueryLatency.add(duration);

            const success = check(response, {
                'user status is 200': (r) => r.status === 200,
                'user response has data': (r) => {
                    const body = JSON.parse(r.body);
                    return body.data?.user?.id !== undefined;
                },
                'user response has no errors': (r) => {
                    const body = JSON.parse(r.body);
                    return !body.errors;
                },
            });

            if (success) {
                successfulRequests.add(1);
                errorRate.add(0);
            } else {
                failedRequests.add(1);
                errorRate.add(1);
                console.log('User query failed:', response.body);
            }
        });
    }

    // Small pause between requests
    sleep(0.05);

    // Test 3: Refresh token (every 10th iteration)
    if (__ITER % 10 === 0 && refreshToken) {
        group('Refresh Token', () => {
            const startTime = Date.now();
            const response = graphqlRequest(queries.refreshToken, { refreshToken: refreshToken }, null);
            const duration = Date.now() - startTime;
            refreshTokenLatency.add(duration);

            const success = check(response, {
                'refresh status is 200': (r) => r.status === 200,
                'refresh response has tokens': (r) => {
                    const body = JSON.parse(r.body);
                    return body.data?.refreshToken?.accessToken !== undefined;
                },
            });

            if (success) {
                successfulRequests.add(1);
                errorRate.add(0);
            } else {
                failedRequests.add(1);
                errorRate.add(1);
            }
        });
    }

    // Small pause before next iteration
    sleep(0.1);
}

// Teardown function - run once after all VUs finish
export function teardown(data) {
    console.log('Load test completed!');
    console.log('Check Prometheus/Grafana for P95 and P99 metrics');
}

// Handle summary (optional - provides detailed report)
export function handleSummary(data) {
    console.log('\n=== K6 Load Test Summary ===\n');

    const meP95 = data.metrics.me_query_latency_ms?.values['p(95)'] || 'N/A';
    const meP99 = data.metrics.me_query_latency_ms?.values['p(99)'] || 'N/A';
    const userP95 = data.metrics.user_query_latency_ms?.values['p(95)'] || 'N/A';
    const userP99 = data.metrics.user_query_latency_ms?.values['p(99)'] || 'N/A';
    const loginP95 = data.metrics.login_latency_ms?.values['p(95)'] || 'N/A';
    const loginP99 = data.metrics.login_latency_ms?.values['p(99)'] || 'N/A';

    console.log('Me Query Latency:');
    console.log(`  P95: ${meP95}ms`);
    console.log(`  P99: ${meP99}ms`);
    console.log('');
    console.log('User Query Latency:');
    console.log(`  P95: ${userP95}ms`);
    console.log(`  P99: ${userP99}ms`);
    console.log('');
    console.log('Login Latency:');
    console.log(`  P95: ${loginP95}ms`);
    console.log(`  P99: ${loginP99}ms`);
    console.log('');
    console.log(`Total Successful Requests: ${data.metrics.successful_requests?.values.count || 0}`);
    console.log(`Total Failed Requests: ${data.metrics.failed_requests?.values.count || 0}`);
    console.log(`Error Rate: ${(data.metrics.error_rate?.values.rate * 100 || 0).toFixed(2)}%`);

    return {
        'stdout': JSON.stringify(data, null, 2),
    };
}
