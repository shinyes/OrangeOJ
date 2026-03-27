# OrangeOJ Development Scripts

## Quick Start

### Windows (PowerShell)

```powershell
# Start both backend and frontend servers
.\scripts\start-dev.ps1

# Stop all servers
.\scripts\stop-servers.ps1
```

### Linux/Mac (Bash)

```bash
# Make scripts executable (first time only)
chmod +x scripts/*.sh

# Start both backend and frontend servers
./scripts/start-dev.sh

# Stop all servers
./scripts/stop-servers.sh
```

## Manual Start

If you prefer to start servers manually:

### Backend

```bash
cd backend
go run .
```

Backend will run on `http://localhost:8080`

### Frontend

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5173`

## Features

- ✅ Automatic cleanup of existing processes on ports 8080 and 5173
- ✅ Parallel startup of both servers
- ✅ Real-time status monitoring
- ✅ Graceful shutdown with Ctrl+C
- ✅ Log files (Linux/Mac): `logs/backend.log` and `logs/frontend.log`
- ✅ Background job management (Windows)

## Troubleshooting

### Port Already in Use

The scripts automatically kill processes on ports 8080 and 5173. If issues persist:

**Windows:**
```powershell
# Manually kill processes
netstat -ano | findstr :8080
taskkill /F /PID <PID>
```

**Linux/Mac:**
```bash
# Manually kill processes
lsof -ti:8080 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Backend Won't Start

Check if Go is installed:
```bash
go version
```

Check backend logs for errors.

### Frontend Won't Start

Install dependencies first:
```bash
cd frontend
npm install
```

Then start the server.

## Architecture

```
OrangeOJ/
├── backend/          # Go backend server (port 8080)
│   ├── main.go
│   ├── internal/    # Business logic
│   └── api/         # HTTP handlers
├── frontend/         # React/Vite frontend (port 5173)
│   ├── src/
│   ├── package.json
│   └── vite.config.js
└── scripts/          # Development scripts
    ├── start-dev.ps1    # Windows starter
    ├── start-dev.sh     # Unix starter
    ├── stop-servers.ps1 # Windows stopper
    └── stop-servers.sh  # Unix stopper
```

## Notes

- Backend requires Go 1.19+
- Frontend requires Node.js 16+ and npm
- Default JWT secret and judge token are for development only
- Change secrets in production environment variables
