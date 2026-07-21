# Marketplace Manager - Startup Script
# Run from the project root: .\start.ps1

$PROJECT_ROOT = $PSScriptRoot
$BACKEND_DIR = Join-Path $PROJECT_ROOT 'backend'
$FRONTEND_DIR = Join-Path $PROJECT_ROOT 'frontend'
$BACKEND_PORT = 3001
$FRONTEND_PORT = 5173

function Test-Port {
    param([int]$port)
    $conn = netstat -ano | Select-String "LISTENING" | Where-Object { $_ -match ":$port\b" }
    return $null -ne $conn
}

function Write-Header {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host "  Marketplace Manager" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Magenta
    Write-Host ""
}

function Stop-Server {
    param([int]$port, [string]$name)
    # Find PIDs listening on this port
    $lines = netstat -ano | Select-String "LISTENING" | Where-Object { $_ -match ":$port\b" }
    if ($lines) {
        $pids = $lines | ForEach-Object { $_.Line } | ForEach-Object { $_.Trim().Split(' ')[-1] } | Select-Object -Unique
        foreach ($procId in $pids) {
            if ($procId -and $procId -ne '0') {
                # Kill the process tree (parent + all children)
                Get-CimInstance Win32_Process -Filter "ParentProcessId = $procId" | ForEach-Object {
                    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
                }
                Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            }
        }
        Write-Host "  Stopped $name (port $port, PID(s): $($pids -join ', '))" -ForegroundColor Red

        # Wait for port to actually free up
        $maxRetries = 10
        for ($i = 0; $i -lt $maxRetries; $i++) {
            if (-not (Test-Port $port)) { return }
            Start-Sleep -Milliseconds 500
        }
        Write-Host "  WARNING: Port $port is still in use!" -ForegroundColor Yellow
    }
}

function Start-Backend {
    Write-Host "  Starting backend..." -ForegroundColor Green
    Start-Process wt -ArgumentList "-d", "$BACKEND_DIR", "cmd", "/k", "title Backend & npm start"
    Start-Sleep -Seconds 3
}

function Start-Frontend {
    Write-Host "  Starting frontend..." -ForegroundColor Green
    Start-Process wt -ArgumentList "-d", "$FRONTEND_DIR", "cmd", "/k", "title Frontend & npm run dev"
    Start-Sleep -Seconds 3
}

function Open-Browser {
    Write-Host "  Opening browser..." -ForegroundColor Green
    Start-Process "http://localhost:$FRONTEND_PORT"
}

# Main
Write-Header

$backendRunning = Test-Port $BACKEND_PORT
$frontendRunning = Test-Port $FRONTEND_PORT

$backendStatus = if ($backendRunning) { 'Running' } else { 'Stopped' }
$frontendStatus = if ($frontendRunning) { 'Running' } else { 'Stopped' }

Write-Host "Status:" -ForegroundColor Yellow
Write-Host "  Backend  (port $BACKEND_PORT):  $backendStatus" -ForegroundColor $(if ($backendRunning) { 'Green' } else { 'Red' })
Write-Host "  Frontend (port $FRONTEND_PORT): $frontendStatus" -ForegroundColor $(if ($frontendRunning) { 'Green' } else { 'Red' })
Write-Host ""

if ($backendRunning -and $frontendRunning) {
    Write-Host "Both servers are running. What would you like to do?" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] Open app in browser"
    Write-Host "  [2] Restart backend only"
    Write-Host "  [3] Restart frontend only"
    Write-Host "  [4] Restart both"
    Write-Host "  [5] Exit"
    $choice = Read-Host "  Select an option"

    switch ($choice) {
        "1" { Open-Browser }
        "2" { Stop-Server $BACKEND_PORT "Backend"; Start-Sleep -Seconds 1; Start-Backend }
        "3" { Stop-Server $FRONTEND_PORT "Frontend"; Start-Sleep -Seconds 1; Start-Frontend }
        "4" { Stop-Server $BACKEND_PORT "Backend"; Stop-Server $FRONTEND_PORT "Frontend"; Start-Sleep -Seconds 1; Start-Backend; Start-Frontend }
        "5" { Write-Host "  Goodbye!" -ForegroundColor Yellow }
        default { Write-Host "  Invalid option." -ForegroundColor Red }
    }
} elseif ($backendRunning) {
    Write-Host "Backend is running, frontend is stopped." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] Start frontend"
    Write-Host "  [2] Restart backend"
    Write-Host "  [3] Restart both"
    Write-Host "  [4] Exit"
    $choice = Read-Host "  Select an option"

    switch ($choice) {
        "1" { Start-Frontend }
        "2" { Stop-Server $BACKEND_PORT "Backend"; Start-Sleep -Seconds 1; Start-Backend }
        "3" { Stop-Server $BACKEND_PORT "Backend"; Stop-Server $FRONTEND_PORT "Frontend"; Start-Sleep -Seconds 1; Start-Backend; Start-Frontend }
        "4" { Write-Host "  Goodbye!" -ForegroundColor Yellow }
        default { Write-Host "  Invalid option." -ForegroundColor Red }
    }
} elseif ($frontendRunning) {
    Write-Host "Frontend is running, backend is stopped." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] Start backend"
    Write-Host "  [2] Restart frontend"
    Write-Host "  [3] Restart both"
    Write-Host "  [4] Exit"
    $choice = Read-Host "  Select an option"

    switch ($choice) {
        "1" { Start-Backend }
        "2" { Stop-Server $FRONTEND_PORT "Frontend"; Start-Sleep -Seconds 1; Start-Frontend }
        "3" { Stop-Server $BACKEND_PORT "Backend"; Stop-Server $FRONTEND_PORT "Frontend"; Start-Sleep -Seconds 1; Start-Backend; Start-Frontend }
        "4" { Write-Host "  Goodbye!" -ForegroundColor Yellow }
        default { Write-Host "  Invalid option." -ForegroundColor Red }
    }
} else {
    Write-Host "Both servers are stopped." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  [1] Start both servers"
    Write-Host "  [2] Start backend only"
    Write-Host "  [3] Start frontend only"
    Write-Host "  [4] Exit"
    $choice = Read-Host "  Select an option"

    switch ($choice) {
        "1" { Start-Backend; Start-Frontend }
        "2" { Start-Backend }
        "3" { Start-Frontend }
        "4" { Write-Host "  Goodbye!" -ForegroundColor Yellow }
        default { Write-Host "  Invalid option." -ForegroundColor Red }
    }
}

Write-Host ""