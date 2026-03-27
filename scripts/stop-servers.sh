#!/usr/bin/env bash

# OrangeOJ Development Server Stopper (Unix/Linux/Mac)
# This script stops all development servers

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "========================================"
echo "  Stopping OrangeOJ Development Servers"
echo "========================================"
echo ""

# Function to kill process using a port
kill_port_process() {
    local port=$1
    if lsof -ti:$port >/dev/null 2>&1; then
        echo "Stopping process on port $port..."
        kill -9 $(lsof -ti:$port) 2>/dev/null || true
        sleep 0.5
        
        # Verify it's stopped
        if lsof -ti:$port >/dev/null 2>&1; then
            echo "  ⚠ Process still running, forcing stop..."
            kill -9 $(lsof -ti:$port) 2>/dev/null || true
        else
            echo "  ✓ Stopped successfully"
        fi
    else
        echo "No process found on port $port"
    fi
}

# Stop processes on ports
echo "[1/2] Stopping backend server (port 8080)..."
kill_port_process 8080

echo "[2/2] Stopping frontend server (port 5173)..."
kill_port_process 5173

echo ""
echo "========================================"
echo "  All servers stopped successfully!"
echo "========================================"
