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
});

const userProto = grpc.loadPackageDefinition(packageDefinition).user;

const client = new userProto.UserService(
    'localhost:50051',
    grpc.credentials.createInsecure()
);

console.log('🔗 Connecting to gRPC server at localhost:50051...');

client.HelloWorld({ name: 'Test User' }, (error, response) => {
    if (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
    console.log('✅ Response:', response.message);
    process.exit(0);
});
