#!/usr/bin/env powershell

# OrangeOJ Development Server Stopper
# This script stops all development servers

$ErrorActionPreference = "SilentlyContinue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Stopping OrangeOJ Development Servers" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Function to kill process using a port
function Kill-PortProcess {
    param([int]$Port)
    $processId = (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue).OwningProcess
    if ($processId) {
        Write-Host "Stopping process on port $Port (PID: $processId)..." -ForegroundColor Yellow
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
        
        # Verify it's stopped
        $stillRunning = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($stillRunning) {
            Write-Host "  ⚠ Process still running, forcing stop..." -ForegroundColor Red
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        } else {
            Write-Host "  ✓ Stopped successfully" -ForegroundColor Green
        }
    } else {
        Write-Host "No process found on port $Port" -ForegroundColor Gray
    }
}

# Stop background jobs
Write-Host "[1/3] Stopping background jobs..." -ForegroundColor Green
$jobs = Get-Job | Where-Object { $_.Name -like "*OrangeOJ*" -or $_.Command -like "*go run*" -or $_.Command -like "*npm run dev*" }
foreach ($job in $jobs) {
    Write-Host "  Stopping job: $($job.Name) (ID: $($job.Id))" -ForegroundColor Yellow
    Stop-Job $job -ErrorAction SilentlyContinue
    Remove-Job $job -ErrorAction SilentlyContinue
}
Write-Host "  ✓ Jobs stopped" -ForegroundColor Green

# Stop processes on ports
Write-Host "[2/3] Stopping backend server (port 8080)..." -ForegroundColor Green
Kill-PortProcess -Port 8080

Write-Host "[3/3] Stopping frontend server (port 5173)..." -ForegroundColor Green
Kill-PortProcess -Port 5173

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  All servers stopped successfully!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
