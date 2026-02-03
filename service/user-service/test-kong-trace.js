// Test through Kong → BFF → User Service → DB for full tracing
const http = require('http');

const testEmail = `kong-trace-${Date.now()}@example.com`;

const queries = {
    register: `
    mutation {
      register(input: {
        tenantId: "tenant-kong-trace",
        email: "${testEmail}",
        password: "Test123!@#",
        firstName: "Kong",
        lastName: "Trace"
      }) {
        user { id email }
        success
        message
      }
    }
  `,
    login: `
    mutation {
      login(input: {
        tenantId: "tenant-kong-trace",
        email: "${testEmail}",
        password: "Test123!@#"
      }) {
        user { id email }
        tokens {
          accessToken
          refreshToken
          expiresIn
        }
      }
    }
  `,
};

async function graphqlRequest(query) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ query });

        const options = {
            hostname: 'localhost',
            port: 8000,
            path: '/graphql',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
            },
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ raw: body });
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function runFullTraceTest() {
    console.log('🧪 Full Stack Trace Test: Kong → BFF → User Service → DB/Redis\n');
    console.log('Test email:', testEmail);
    console.log('='.repeat(60) + '\n');

    try {
        // Test 1: Register through Kong
        console.log('📝 Step 1: Register (Kong → BFF → User Service → MongoDB)');
        const registerStart = Date.now();
        const registerRes = await graphqlRequest(queries.register);
        const registerTime = Date.now() - registerStart;

        if (registerRes.errors) {
            console.log('   ❌ Error:', registerRes.errors[0].message);
        } else {
            console.log(`   ✅ Registered in ${registerTime}ms`);
            console.log('   User ID:', registerRes.data?.register?.user?.id);
        }

        // Wait a bit for traces to propagate
        await new Promise(r => setTimeout(r, 500));

        // Test 2: Login through Kong
        console.log('\n🔐 Step 2: Login (Kong → BFF → User Service → MongoDB → Redis)');
        const loginStart = Date.now();
        const loginRes = await graphqlRequest(queries.login);
        const loginTime = Date.now() - loginStart;

        if (loginRes.errors) {
            console.log('   ❌ Error:', loginRes.errors[0].message);
        } else {
            console.log(`   ✅ Login in ${loginTime}ms`);
            console.log('   Access Token:', loginRes.data?.login?.tokens?.accessToken?.substring(0, 40) + '...');
        }

        // Test 3: Login again (cache should be warm)
        console.log('\n⚡ Step 3: Login again (cache warm - Near Cache + Redis)');
        const login2Start = Date.now();
        const login2Res = await graphqlRequest(queries.login);
        const login2Time = Date.now() - login2Start;

        if (login2Res.errors) {
            console.log('   ❌ Error:', login2Res.errors[0].message);
        } else {
            console.log(`   ✅ Login in ${login2Time}ms`);
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Summary:');
        console.log(`   Register: ${registerTime}ms`);
        console.log(`   Login 1:  ${loginTime}ms`);
        console.log(`   Login 2:  ${login2Time}ms (cache)`);
        console.log('='.repeat(60));
        console.log('\n🔍 Check Grafana/Tempo for trace breakdown:');
        console.log('   1. Open http://localhost:3000/explore');
        console.log('   2. Select Tempo data source');
        console.log('   3. Search for traces with duration > 100ms');
        console.log('   4. Look for bff-service → user-service → mongodb/redis spans');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

runFullTraceTest();
