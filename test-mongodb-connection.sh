#!/bin/bash

echo "Testing MongoDB Connection from user-service..."

# Get user-service pod name
POD=$(kubectl get pods -n dev -l app=user-service -o jsonpath='{.items[0].metadata.name}')

if [ -z "$POD" ]; then
  echo "❌ User-service pod not found"
  exit 1
fi

echo "Pod found: $POD"
echo "Checking MongoDB connection..."

# Test connection
kubectl exec -n dev $POD -- node -e "
const mongoose = require('mongoose');
const uri = process.env.MONGODB_URI;
console.log('Connecting to:', uri.replace(/password[^@]*/, 'password:***'));

mongoose.connect(uri, {
  serverSelectionTimeoutMS: 5000
}).then(() => {
  console.log('✅ MongoDB connected successfully!');
  mongoose.connection.close();
  process.exit(0);
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});
"

