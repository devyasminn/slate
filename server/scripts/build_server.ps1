<# Build the onefile sidecar. QA callers must supply their isolated session directory. #>
param([string]$QaSessionDir)
$ErrorActionPreference = "Stop"
$ServerDir = Split-Path -Parent $PSScriptRoot
$RepoRoot = Split-Path -Parent $ServerDir
$ClientDir = Join-Path $RepoRoot "client"
$IsQa = -not [string]::IsNullOrEmpty($QaSessionDir)
if ($env:SLATE_ENV -eq "qa" -and -not $IsQa) {
    throw "QA cannot write normal sidecar outputs. Use npm run editor:qa."
}
if ($IsQa) {
    $QaSessionDir = [IO.Path]::GetFullPath($QaSessionDir)
    $SessionId = Split-Path -Leaf $QaSessionDir
    $Expected = Join-Path $RepoRoot ".qa\sessions\$SessionId"
    $ParsedId = [Guid]::Empty
    if ($QaSessionDir -ne $Expected -or -not [Guid]::TryParse($SessionId, [ref]$ParsedId)) {
        throw "QA build directory must be .qa/sessions/<UUID> inside this checkout."
    }
    foreach ($Directory in @((Join-Path $RepoRoot ".qa"), (Join-Path $RepoRoot ".qa\sessions"), $QaSessionDir)) {
        if ((Get-Item -LiteralPath $Directory).Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "QA build directories must not be links or junctions."
        }
    }
    $OutputDir = Join-Path $QaSessionDir "binaries"
    $DistPath = Join-Path $QaSessionDir "server-dist"
    $BuildPath = Join-Path $QaSessionDir "pyinstaller-work"
    $SpecPath = Join-Path $QaSessionDir "spec"
    $ClientDistPath = Join-Path $QaSessionDir "client-dist"
    $env:PYINSTALLER_CONFIG_DIR = Join-Path $QaSessionDir "pyinstaller-cache"
} else {
    $OutputDir = Join-Path $RepoRoot "editor\src-tauri\binaries"
    $DistPath = Join-Path $ServerDir "dist"
    $BuildPath = Join-Path $ServerDir "build"
    $SpecPath = $ServerDir
    $ClientDistPath = Join-Path $ClientDir "dist"
}

function Assert-Exit([string]$Step) {
    if ($LASTEXITCODE -ne 0) { throw "$Step failed (exit $LASTEXITCODE)" }
}

Write-Host "Building Slate sidecar into $OutputDir"
Push-Location $ClientDir
try {
    if (-not (Test-Path "node_modules")) {
        if ($IsQa) { throw "Install client dependencies first (npm run setup)." }
        npm install --quiet
        Assert-Exit "Client dependency installation"
    }
    if ($IsQa) {
        # Keep TypeScript/Vite intermediate outputs out of the development build directories too.
        foreach ($Project in @("app", "node")) {
            & node "node_modules/typescript/bin/tsc" -p "tsconfig.$Project.json" --incremental --tsBuildInfoFile "$QaSessionDir/client-$Project.tsbuildinfo"
            Assert-Exit "Client TypeScript check"
        }
        & node "node_modules/vite/bin/vite.js" build --outDir $ClientDistPath --emptyOutDir --configLoader runner
    } else {
        npm run build --quiet
    }
    Assert-Exit "Client build"
} finally { Pop-Location }

$VenvPath = Join-Path $ServerDir ".venv"
$Python = Join-Path $VenvPath "Scripts/python.exe"
if ($IsQa) {
    if (-not (Test-Path -LiteralPath $Python)) {
        throw "QA requires server/.venv with requirements.txt and pyinstaller installed; see README."
    }
} else {
    if (-not (Test-Path -LiteralPath $Python)) {
        python -m venv $VenvPath
        Assert-Exit "Virtual environment creation"
    }
    & $Python -m pip install -r "$ServerDir/requirements.txt" --quiet
    Assert-Exit "Server dependency installation"
    & $Python -m pip install pyinstaller --quiet
    Assert-Exit "PyInstaller installation"
}

Push-Location $ServerDir
try {
    $QaHooks = @()
    if ($IsQa) {
        # Mark the binary itself as QA: even a direct/accidental launch cannot open personal data.
        New-Item -ItemType Directory -Path $SpecPath -Force | Out-Null
        $HookPath = Join-Path $SpecPath "qa_identity.py"
        $DevelopmentData = (Join-Path $ServerDir "data") | ConvertTo-Json -Compress
        @("import sys", "sys._slate_qa_build = True", "sys._slate_development_data_dir = $DevelopmentData") | Set-Content -LiteralPath $HookPath -Encoding UTF8
        $QaHooks = @("--runtime-hook", $HookPath)
    }
    & $Python -m PyInstaller --name "slate-server" --onefile --noconsole --clean --noconfirm `
        --add-data "$ClientDistPath;client/dist" --distpath $DistPath --workpath $BuildPath `
        --specpath $SpecPath @QaHooks "$ServerDir/main.py"
    Assert-Exit "PyInstaller build"
} finally { Pop-Location }

$TargetTriple = (& rustc --print host-tuple)
Assert-Exit "Rust target detection"
$TargetTriple = $TargetTriple.Trim()
New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
$SourceExe = Join-Path $DistPath "slate-server.exe"
$DestExe = Join-Path $OutputDir "slate-server-$TargetTriple.exe"
Copy-Item -LiteralPath $SourceExe -Destination $DestExe -Force
Write-Host "Sidecar ready: $DestExe"
