# KapasSetu AI — One-Command Local Multi-Service Launcher (Zero Docker Required)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Starting KapasSetu AI Full-Stack Suite..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\backend'; .\.venv\Scripts\uvicorn.exe app.main:app --reload --host 0.0.0.0 --port 8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\frontend-kisan'; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$Root\frontend-ginner'; npm run dev"

Write-Host "-> FastAPI Backend & Swagger Docs : http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host "-> Farmer Mobile PWA (Kisan)      : http://localhost:5173" -ForegroundColor Yellow
Write-Host "-> Ginner B2B Console & PLC HAL   : http://localhost:5174" -ForegroundColor Magenta

