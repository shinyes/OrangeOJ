#!/usr/bin/env powershell

# OrangeOJ Development Server Starter
# This script starts both backend and frontend development servers

$ErrorActionPreference = "Stop"
$BackendPort = 8080
$FrontendPort = 5173
$ROOT_DIR = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OrangeOJ Development Server Starter" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if port is in use
function Test-PortInUse {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $null -ne $connection
}

# Function to kill process using a port
function Kill-PortProcess {
    param([int]$Port)
    $processId = (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue).OwningProcess
    if ($processId) {
        Write-Host "Killing process on port $Port (PID: $processId)..." -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
}

# Clean up existing processes
Write-Host "[1/4] Cleaning up existing processes..." -ForegroundColor Green
Kill-PortProcess -Port $BackendPort
Kill-PortProcess -Port $FrontendPort

# Start backend server
Write-Host "[2/4] Starting backend server on port $BackendPort..." -ForegroundColor Green
$backendJob = Start-Job -ScriptBlock {
    Set-Location "$using:ROOT_DIR\backend"
    & go run .
}

# Wait for backend to start
Write-Host "     Waiting for backend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 3

# Check if backend started successfully
Start-Sleep -Seconds 2
$backendOutput = Receive-Job $backendJob -ErrorAction SilentlyContinue -Keep | Select-Object -Last 10
if ($backendOutput -match "OrangeOJ started" -or $backendJob.State -eq "Running") {
    Write-Host "     ✓ Backend started successfully!" -ForegroundColor Green
} else {
    Write-Host "     ⚠ Backend may still be starting..." -ForegroundColor Yellow
}

# Start frontend server
Write-Host "[3/4] Starting frontend server on port $FrontendPort..." -ForegroundColor Green
$frontendJob = Start-Job -ScriptBlock {
    Set-Location "$using:ROOT_DIR\frontend"
    & npm run dev
}

# Wait for frontend to start
Write-Host "     Waiting for frontend to initialize..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "[4/4] Servers are running!" -ForegroundColor Green
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Server Status" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend:  http://localhost:$BackendPort" -ForegroundColor Blue
Write-Host "  Frontend: http://localhost:$FrontendPort" -ForegroundColor Blue
Write-Host ""
Write-Host "  Backend Job ID:  $($backendJob.Id)" -ForegroundColor Gray
Write-Host "  Frontend Job ID: $($frontendJob.Id)" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Commands" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To stop servers:  .\scripts\stop-servers.ps1" -ForegroundColor Yellow
Write-Host "  To view logs:     Receive-Job -Id $($backendJob.Id) -Keep" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to exit and keep servers running" -ForegroundColor Gray
Write-Host ""

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
        
        # Check if jobs are still running
        $backendState = (Get-Job $backendJob.Id).State
        $frontendState = (Get-Job $frontendJob.Id).State
        
        if ($backendState -eq "Failed" -or $frontendState -eq "Failed") {
            Write-Host "One of the servers has stopped unexpectedly!" -ForegroundColor Red
            break
        }
    }
}
catch [System.Management.Automation.Remoting.PSRemotingTransportException] {
    # Ignore Ctrl+C
}
finally {
    Write-Host "`nStopping servers..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "Servers stopped." -ForegroundColor Green
}
