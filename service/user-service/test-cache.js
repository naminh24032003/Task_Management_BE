const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, '../../packages/proto/user/v1/user.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, '../../packages/proto')],
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

// AuthService for auth endpoints
const AuthService = protoDescriptor.user.v1.AuthService;
const authClient = new AuthService(
    'localhost:50051',
    grpc.credentials.createInsecure()
);

// UserService for user management
const UserService = protoDescriptor.user.v1.UserService;
const userClient = new UserService(
    'localhost:50051',
    grpc.credentials.createInsecure()
);

const tenantId = 'tenant-test-cache';
const testEmail = `cache-test-${Date.now()}@example.com`;
const testPassword = 'Test123!@#';

console.log('🧪 Testing Multi-Tier Cache Implementation\n');

function promisify(client, method) {
    return (request) => new Promise((resolve, reject) => {
        method.call(client, request, (error, response) => {
            if (error) reject(error);
            else resolve(response);
        });
    });
}

async function runTests() {
    try {
        // Test 1: Register user
        console.log('📝 Test 1: Register new user...');
        const registerRes = await promisify(authClient, authClient.Register)({
            tenant_id: tenantId,
            email: testEmail,
            password: testPassword,
            first_name: 'Cache',
            last_name: 'Test',
        });
        console.log('   ✅ User registered:', registerRes.user?.id || 'unknown');
        const userId = registerRes.user?.id;

        // Test 2: Login (should cache session)
        console.log('\n🔐 Test 2: Login (cache session + permissions)...');
        const loginStart = Date.now();
        const loginRes = await promisify(authClient, authClient.Login)({
            tenant_id: tenantId,
            email: testEmail,
            password: testPassword,
        });
        console.log(`   ✅ Login success in ${Date.now() - loginStart}ms`);
        const accessToken = loginRes.tokens?.access_token;
        console.log('   Access Token (first 50 chars):', accessToken?.substring(0, 50) + '...');

        if (!accessToken) {
            console.error('   ❌ No access token received!');
            return;
        }

        // Test 3: Validate token (1st call)
        console.log('\n🔍 Test 3: Validate token (1st call)...');
        try {
            const validate1Start = Date.now();
            const validate1Res = await promisify(authClient, authClient.ValidateToken)({
                access_token: accessToken,
            });
            console.log(`   ✅ Valid: ${validate1Res.valid} in ${Date.now() - validate1Start}ms`);
            console.log(`   User ID: ${validate1Res.user_id}`);
            console.log(`   Roles: ${validate1Res.roles?.join(', ') || 'none'}`);
        } catch (validateError) {
            console.error('   ⚠️ ValidateToken error:', validateError.message);
            console.error('   Details:', JSON.stringify(validateError, null, 2));
        }

        // Test 4: Validate token again (should be near cache hit)
        console.log('\n⚡ Test 4: Validate token (2nd call - Near Cache)...');
        try {
            const validate2Start = Date.now();
            const validate2Res = await promisify(authClient, authClient.ValidateToken)({
                access_token: accessToken,
            });
            console.log(`   ✅ Valid: ${validate2Res.valid} in ${Date.now() - validate2Start}ms`);
        } catch (validateError) {
            console.error('   ⚠️ ValidateToken error:', validateError.message);
        }

        // Test 5: Validate token 3rd time
        console.log('\n⚡ Test 5: Validate token (3rd call - Near Cache)...');
        try {
            const validate3Start = Date.now();
            const validate3Res = await promisify(authClient, authClient.ValidateToken)({
                access_token: accessToken,
            });
            console.log(`   ✅ Valid: ${validate3Res.valid} in ${Date.now() - validate3Start}ms`);
        } catch (validateError) {
            console.error('   ⚠️ ValidateToken error:', validateError.message);
        }

        console.log('\n' + '='.repeat(50));
        console.log('🎉 Basic registration & login tests passed!');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('   Code:', error.code);
        console.error('   Details:', error.details || 'N/A');
        console.error('   Stack:', error.stack);
    }
}

runTests();
