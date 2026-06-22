#Requires -Version 5.1
<#
.SYNOPSIS
    One-command Windows setup for Smart Invoice Summarizer v0.4.0

.DESCRIPTION
    This script:
      1. Verifies Python 3.11+ is installed
      2. Checks git is available
      3. Pulls the latest code from GitHub (branch: claude/invoice-summarizer-architecture-y22ao4)
      4. Creates a Python virtual environment
      5. Installs all Python dependencies
      6. Installs Tesseract OCR (via winget) for Norwegian document support
      7. Writes a run.bat launcher to the project folder

.USAGE
    Right-click INSTALL_WINDOWS.ps1 -> "Run with PowerShell"
    -or-
    Open PowerShell as Administrator and run:
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
        .\INSTALL_WINDOWS.ps1

.NOTES
    Internet connection required.
    Tesseract step requires winget (comes with Windows 10 1709+ / Windows 11).
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$REPO_URL    = 'https://github.com/thher/ltp-app.git'
$BRANCH      = 'claude/invoice-summarizer-architecture-y22ao4'
$APP_SUBDIR  = 'invoice_summarizer'
$VENV_DIR    = '.venv'

function Write-Header($msg) {
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}

function Write-Step($n, $msg) {
    Write-Host ""
    Write-Host "[$n] $msg" -ForegroundColor Yellow
}

function Write-OK($msg)   { Write-Host "  OK  $msg" -ForegroundColor Green }
function Write-WARN($msg) { Write-Host "  WARN $msg" -ForegroundColor DarkYellow }
function Write-FAIL($msg) { Write-Host "  FAIL $msg" -ForegroundColor Red }

Write-Header "Smart Invoice Summarizer v0.4.0 — Windows Setup"

# ── 1. Python check ──────────────────────────────────────────────────────────
Write-Step 1 "Checking Python 3.11+..."

$pythonCmd = $null
foreach ($candidate in @('python', 'python3', 'py')) {
    try {
        $ver = & $candidate --version 2>&1
        if ($ver -match 'Python (\d+)\.(\d+)') {
            $major = [int]$Matches[1]
            $minor = [int]$Matches[2]
            if ($major -eq 3 -and $minor -ge 11) {
                $pythonCmd = $candidate
                Write-OK "Found: $ver"
                break
            }
        }
    } catch { }
}

if (-not $pythonCmd) {
    Write-FAIL 'Python 3.11 or newer was not found on PATH.'
    Write-Host ''
    Write-Host '  Install Python 3.11 from the Microsoft Store:' -ForegroundColor White
    Write-Host '    winget install Python.Python.3.11' -ForegroundColor White
    Write-Host '  -or- download from: https://www.python.org/downloads/' -ForegroundColor White
    Write-Host '  Make sure to check "Add Python to PATH" during installation.' -ForegroundColor White
    Write-Host ''
    Read-Host 'Press ENTER to exit'
    exit 1
}

# ── 2. Git check ─────────────────────────────────────────────────────────────
Write-Step 2 "Checking git..."
try {
    $gitVer = & git --version 2>&1
    Write-OK $gitVer
} catch {
    Write-FAIL 'git not found.'
    Write-Host ''
    Write-Host '  Install git:' -ForegroundColor White
    Write-Host '    winget install Git.Git' -ForegroundColor White
    Write-Host '  -or- download from: https://git-scm.com/download/win' -ForegroundColor White
    Write-Host ''
    Read-Host 'Press ENTER to exit'
    exit 1
}

# ── 3. Clone or update repo ───────────────────────────────────────────────────
Write-Step 3 "Fetching source code..."

$installRoot = Join-Path $env:USERPROFILE 'SmartInvoiceSummarizer'
$appDir      = Join-Path $installRoot $APP_SUBDIR

if (Test-Path (Join-Path $installRoot '.git')) {
    Write-Host "  Existing clone found at: $installRoot" -ForegroundColor Gray
    Write-Host "  Pulling latest changes..." -ForegroundColor Gray
    Push-Location $installRoot
    try {
        & git fetch origin $BRANCH
        & git checkout $BRANCH
        & git pull origin $BRANCH
    } finally {
        Pop-Location
    }
    Write-OK 'Repository updated.'
} else {
    Write-Host "  Cloning to: $installRoot" -ForegroundColor Gray
    & git clone --branch $BRANCH --single-branch $REPO_URL $installRoot
    Write-OK 'Repository cloned.'
}

# ── 4. Create virtual environment ────────────────────────────────────────────
Write-Step 4 "Creating Python virtual environment..."

$venvPath    = Join-Path $appDir $VENV_DIR
$venvPython  = Join-Path $venvPath 'Scripts\python.exe'
$venvPip     = Join-Path $venvPath 'Scripts\pip.exe'

if (-not (Test-Path $venvPython)) {
    & $pythonCmd -m venv $venvPath
    Write-OK "Virtual environment created at: $venvPath"
} else {
    Write-OK "Virtual environment already exists — reusing."
}

# ── 5. Install Python dependencies ───────────────────────────────────────────
Write-Step 5 "Installing Python dependencies (this may take a few minutes)..."

$reqFile = Join-Path $appDir 'requirements.txt'
if (-not (Test-Path $reqFile)) {
    Write-FAIL "requirements.txt not found at: $reqFile"
    exit 1
}

& $venvPip install --upgrade pip --quiet
& $venvPip install -r $reqFile
Write-OK 'Dependencies installed.'

# ── 6. Tesseract OCR ─────────────────────────────────────────────────────────
Write-Step 6 "Installing Tesseract OCR (for Norwegian invoice scanning)..."

$tessExe = @(
    "$env:ProgramFiles\Tesseract-OCR\tesseract.exe",
    "$env:LOCALAPPDATA\Programs\Tesseract-OCR\tesseract.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if ($tessExe) {
    Write-OK "Tesseract already installed: $tessExe"
} else {
    Write-Host '  Installing Tesseract via winget...' -ForegroundColor Gray
    $wingetResult = winget install --id UB-Mannheim.TesseractOCR --accept-package-agreements --accept-source-agreements 2>&1
    $tessExe = @(
        "$env:ProgramFiles\Tesseract-OCR\tesseract.exe",
        "$env:LOCALAPPDATA\Programs\Tesseract-OCR\tesseract.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($tessExe) {
        Write-OK "Tesseract installed: $tessExe"
    } else {
        Write-WARN 'Automatic Tesseract install could not be verified.'
        Write-Host '  If OCR scanning is needed, download manually from:' -ForegroundColor White
        Write-Host '    https://github.com/UB-Mannheim/tesseract/wiki' -ForegroundColor White
        Write-Host '  Install the Norwegian language pack (nor.traineddata) as well.' -ForegroundColor White
    }
}

# ── 7. Write run.bat ──────────────────────────────────────────────────────────
Write-Step 7 "Writing run.bat launcher..."

$tessDir = if ($tessExe) { Split-Path $tessExe } else { '' }

$runBatContent = @"
@echo off
REM Smart Invoice Summarizer — launch script
SETLOCAL

REM Add Tesseract to PATH so pytesseract can find it
IF EXIST "$tessDir\tesseract.exe" SET PATH=$tessDir;%PATH%

REM Activate venv and start the app
CALL "%~dp0$VENV_DIR\Scripts\activate.bat"
python "%~dp0main.py"
ENDLOCAL
"@

$runBatPath = Join-Path $appDir 'run.bat'
$runBatContent | Set-Content -Path $runBatPath -Encoding ASCII
Write-OK "Launcher written: $runBatPath"

# ── Summary ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Header "Setup Complete!"
Write-Host ""
Write-Host "  App folder : $appDir" -ForegroundColor White
Write-Host "  Launcher   : $runBatPath" -ForegroundColor White
Write-Host ""
Write-Host "  To start the application:" -ForegroundColor Cyan
Write-Host "    Double-click run.bat" -ForegroundColor White
Write-Host "    -or- open a terminal in $appDir and run: run.bat" -ForegroundColor White
Write-Host ""
Write-Host "  IMPORTANT: Your data is stored in:" -ForegroundColor Cyan
Write-Host "    $appDir\data\" -ForegroundColor White
Write-Host "  Back this folder up regularly." -ForegroundColor White
Write-Host ""

Read-Host 'Press ENTER to exit'
