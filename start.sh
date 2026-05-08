#!/bin/bash
echo "Starting backend server..."
echo "Node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "Current directory: $(pwd)"
echo "Environment variables:"
echo "PORT: $PORT"
echo "NODE_ENV: $NODE_ENV"
echo "Starting server..."
node backend/simple-server.js