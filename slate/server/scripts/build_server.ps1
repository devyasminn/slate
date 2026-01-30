<# 
  Build script for Slate Server sidecar (PyInstaller --onefile)
  Includes the client/dist folder to serve the web interface to mobile devices.
  Output: editor/src-tauri/binaries/slate-server-x86_64-pc-windows-msvc.exe
#>

$ErrorActionPreference = "Stop"

$ServerDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ServerDir
$ClientDir = Join-Path $RepoRoot "client"
$OutputDir = Join-Path $RepoRoot "editor\src-tauri\binaries"

Write-Host "=== Building Slate Server Sidecar (onefile) ===" -ForegroundColor Cyan
Write-Host "Server directory: $ServerDir"
Write-Host "Client directory: $ClientDir"
Write-Host "Output directory: $OutputDir"

# 1. Build the client if needed
Write-Host "Checking client build..."
Push-Location $ClientDir
if (-not (Test-Path "dist")) {
    Write-Host "Building client..."
    npm install --quiet
    npm run build --quiet
}
Pop-Location

# 2. Create/activate venv
$VenvPath = Join-Path $ServerDir ".venv"
if (-not (Test-Path $VenvPath)) {
    Write-Host "Creating virtual environment..."
    python -m venv $VenvPath
}

# Activate venv
$ActivateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
if (Test-Path $ActivateScript) {
    . $ActivateScript
} else {
    Write-Error "Failed to find activation script at: $ActivateScript"
    exit 1
}

# 3. Install dependencies
Write-Host "Installing dependencies..."
pip install -r "$ServerDir\requirements.txt" --quiet
pip install pyinstaller --quiet

# 4. Run PyInstaller (onefile - single executable)
# We add --add-data to include the client/dist folder inside the executable
Write-Host "Running PyInstaller (--onefile + assets)..."
Push-Location $ServerDir

$DistPath = Join-Path $ServerDir "dist"
$BuildPath = Join-Path $ServerDir "build"
$ClientDistPath = Join-Path $ClientDir "dist"

# Clean previous builds
if (Test-Path $DistPath) { Remove-Item -Recurse -Force $DistPath }
if (Test-Path $BuildPath) { Remove-Item -Recurse -Force $BuildPath }

# PyInstaller --add-data syntax on Windows: "source;destination"
$AddDataStr = "$ClientDistPath;client/dist"

pyinstaller `
    --name "slate-server" `
    --onefile `
    --noconsole `
    --clean `
    --add-data $AddDataStr `
    --distpath $DistPath `
    --workpath $BuildPath `
    --specpath $ServerDir `
    "$ServerDir\main.py"

Pop-Location

# 5. Ensure output directory exists
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "Created binaries directory: $OutputDir"
}

# 6. Get target triple
$TargetTriple = (rustc --print host-tuple 2>$null)
if (-not $TargetTriple) {
    Write-Host "Warning: Could not detect target triple via rustc, using default" -ForegroundColor Yellow
    $TargetTriple = "x86_64-pc-windows-msvc"
}
$TargetTriple = $TargetTriple.Trim()
Write-Host "Target triple: $TargetTriple"

# 7. Clean old sidecar files
$OldSidecarDir = Join-Path $OutputDir "slate-server-$TargetTriple"
if (Test-Path $OldSidecarDir) {
    Write-Host "Removing old onedir folder: $OldSidecarDir"
    Remove-Item -Recurse -Force $OldSidecarDir
}

# 8. Copy the single executable with target triple suffix
$SourceExe = Join-Path $ServerDir "dist\slate-server.exe"
$DestExe = Join-Path $OutputDir "slate-server-$TargetTriple.exe"

Copy-Item -Path $SourceExe -Destination $DestExe -Force
Write-Host "Sidecar executable: $DestExe" -ForegroundColor Green

Write-Host ""
Write-Host "=== Build Complete (onefile + assets) ===" -ForegroundColor Green
Write-Host "Single executable ready: $DestExe"
