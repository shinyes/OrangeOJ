#!/usr/bin/env bash

# OrangeOJ Development Server Starter (Unix/Linux/Mac)
# This script starts both backend and frontend development servers

set -e

BACKEND_PORT=8080
FRONTEND_PORT=5173
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  OrangeOJ Development Server Starter"
echo "========================================"
echo ""

# Function to check if port is in use
is_port_in_use() {
    lsof -ti:$1 >/dev/null 2>&1
}

# Function to kill process using a port
kill_port_process() {
    local port=$1
    if is_port_in_use $port; then
        echo "Killing process on port $port..."
        kill -9 $(lsof -ti:$port) 2>/dev/null || true
        sleep 1
    fi
}

# Clean up existing processes
echo "[1/4] Cleaning up existing processes..."
kill_port_process $BACKEND_PORT
kill_port_process $FRONTEND_PORT

# Create temp directory for logs
mkdir -p "$ROOT_DIR/logs"

# Start backend server
echo "[2/4] Starting backend server on port $BACKEND_PORT..."
cd "$ROOT_DIR/backend"
go run . > "$ROOT_DIR/logs/backend.log" 2>&1 &
BACKEND_PID=$!
echo "     Backend PID: $BACKEND_PID"

# Wait for backend to start
echo "     Waiting for backend to initialize..."
sleep 3

if ps -p $BACKEND_PID > /dev/null; then
    echo "     ✓ Backend started successfully!"
else
    echo "     ✗ Backend failed to start"
    cat "$ROOT_DIR/logs/backend.log"
    exit 1
fi

# Start frontend server
echo "[3/4] Starting frontend server on port $FRONTEND_PORT..."
cd "$ROOT_DIR/frontend"
npm run dev > "$ROOT_DIR/logs/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "     Frontend PID: $FRONTEND_PID"

# Wait for frontend to start
echo "     Waiting for frontend to initialize..."
sleep 5

if ps -p $FRONTEND_PID > /dev/null; then
    echo "     ✓ Frontend started successfully!"
else
    echo "     ✗ Frontend failed to start"
    cat "$ROOT_DIR/logs/frontend.log"
    exit 1
fi

echo "[4/4] Servers are running!"
echo ""
echo "========================================"
echo "  Server Status"
echo "========================================"
echo ""
echo "  Backend:  http://localhost:$BACKEND_PORT (PID: $BACKEND_PID)"
echo "  Frontend: http://localhost:$FRONTEND_PORT (PID: $FRONTEND_PID)"
echo ""
echo "========================================"
echo "  Commands"
echo "========================================"
echo ""
echo "  To stop servers:  ./scripts/stop-servers.sh"
echo "  To view backend logs:  tail -f logs/backend.log"
echo "  To view frontend logs: tail -f logs/frontend.log"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Cleanup function
cleanup() {
    echo ""
    echo "Stopping servers..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID 2>/dev/null || true
    wait $FRONTEND_PID 2>/dev/null || true
    echo "Servers stopped."
    exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# Keep script running
wait
