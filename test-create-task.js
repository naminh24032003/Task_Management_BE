const http = require('http');

const data = JSON.stringify({
  query: 'mutation CreateTask($input: CreateTaskInput!) { createTask(input: $input) { id title status } }',
  variables: {
    input: {
      title: "Integration Test Task",
      description: "Created via GraphQL to test Kafka",
      projectId: "proj-123"
    }
  }
});

const options = {
  hostname: 'localhost',
  port: 4000,
  path: '/graphql',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => console.log('Response:', body));
});

req.on('error', (e) => console.error('Error:', e));
req.write(data);
req.end();
