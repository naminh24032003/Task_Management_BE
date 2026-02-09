/**
 * K6 Simple Debug - See actual errors
 */

import http from 'k6/http';

const BASE_URL = 'http://localhost:8000';

export const options = {
    vus: 1,
    iterations: 3,
};

const loginMutation = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user { id email status }
      tokens { accessToken refreshToken expiresIn }
    }
  }
`;

export default function () {
    const payload = {
        query: loginMutation,
        variables: {
            input: {
                tenantId: 'tenant-1',
                email: 'naminh240320631@gmail.com',
                password: 'Minhminh123.',
            }
        }
    };

    console.log(`\n=== Request ${__ITER + 1} ===`);

    const response = http.post(`${BASE_URL}/graphql`, JSON.stringify(payload), {
        headers: { 'Content-Type': 'application/json' },
    });

    console.log(`Status: ${response.status}`);

    try {
        const body = JSON.parse(response.body);

        if (body.errors) {
            console.log(`ERROR: ${body.errors[0]?.message}`);
            if (body.errors[0]?.extensions) {
                console.log(`Extensions: ${JSON.stringify(body.errors[0].extensions)}`);
            }
        }

        if (body.data?.login) {
            console.log(`SUCCESS!`);
            console.log(`  User ID: ${body.data.login.user?.id}`);
            console.log(`  Email: ${body.data.login.user?.email}`);
            console.log(`  Status: ${body.data.login.user?.status}`);
            console.log(`  Has Token: ${!!body.data.login.tokens?.accessToken}`);
        }
    } catch (e) {
        console.log(`Parse Error: ${e.message}`);
        console.log(`Body: ${response.body.substring(0, 500)}`);
    }
}
