<#
  restart-tunnel.ps1
  ------------------
  Automatizza l'intero ciclo tunnel -> Vercel con un solo comando:
    1. Verifica che il backend Docker locale sia attivo (porta 3001)
    2. Avvia o riavvia cloudflared.exe e ricava l'URL pubblico (*.trycloudflare.com)
    3. Aggiorna VITE_BACKEND_URL su Vercel (Production)
    4. Attiva la build di produzione su Vercel (via Deploy Hook o Vercel CLI)
    5. Assicura che zenboard.zenbyte.it punti sempre all'ultimo deploy attivo
    6. Verifica finale della connettività

  Uso da PowerShell:
    .\restart-tunnel.ps1
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot ".env"
$LogFile = Join-Path $ProjectRoot "cloudflared.log"
$CustomDomain = "zenboard.zenbyte.it"

if (-not (Test-Path $EnvFile)) {
    Write-Error "File .env non trovato in $ProjectRoot"
    exit 1
}

# Estrai variabili da .env
$token = ""
$scope = ""
$deployHook = ""
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*VERCEL_TOKEN\s*=\s*(.*)\s*$') { $token = $Matches[1].Trim() }
    if ($_ -match '^\s*VERCEL_SCOPE\s*=\s*(.*)\s*$') { $scope = $Matches[1].Trim() }
    if ($_ -match '^\s*VERCEL_DEPLOY_HOOK_URL\s*=\s*(.*)\s*$') { $deployHook = $Matches[1].Trim() }
}

if (-not $token -or -not $scope) {
    Write-Error "Mancano VERCEL_TOKEN o VERCEL_SCOPE nel file .env"
    exit 1
}

# 1. Verifica backend Docker su localhost:3001
Write-Host "`n[1/6] Verifico il backend locale su porta 3001..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 5 | Out-Null
    Write-Host "Backend locale OK." -ForegroundColor Green
} catch {
    Write-Error "Il backend su localhost:3001 non risponde. Avvia prima 'docker compose up -d'."
    exit 1
}

# 2. Individua eseguibile cloudflared
$cloudflaredExe = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
if (-not (Test-Path $cloudflaredExe)) {
    $found = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
    if ($found) { $cloudflaredExe = $found }
    else {
        Write-Error "cloudflared.exe non trovato in C:\Program Files (x86)\cloudflared\"
        exit 1
    }
}

# Controlla se il tunnel in esecuzione e' gia' valido
Write-Host "`n[2/6] Controllo stato del tunnel Cloudflare..." -ForegroundColor Cyan
$existingUrl = $null
if (Test-Path $LogFile) {
    $match = Select-String -Path $LogFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
    if ($match) { $existingUrl = $match.Matches[0].Value }
}

$needRestart = $true
if ($existingUrl) {
    try {
        $res = Invoke-RestMethod -Uri "$existingUrl/api/health" -TimeoutSec 4
        if ($res.status -eq "ok") {
            Write-Host "Il tunnel esistente e' ancora attivo e funzionante: $existingUrl" -ForegroundColor Green
            $newUrl = $existingUrl
            $needRestart = $false
        }
    } catch {
        Write-Host "Il tunnel precedente non risponde piu', avvio un nuovo tunnel..." -ForegroundColor Yellow
    }
}

if ($needRestart) {
    Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
    Remove-Item $LogFile -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 1

    Start-Process -FilePath $cloudflaredExe -ArgumentList "tunnel --url http://localhost:3001 --logfile `"$LogFile`"" -WindowStyle Hidden

    $newUrl = $null
    for ($i = 0; $i -lt 25; $i++) {
        Start-Sleep -Seconds 1
        if (Test-Path $LogFile) {
            $match = Select-String -Path $LogFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
            if ($match) {
                $newUrl = $match.Matches[0].Value
                break
            }
        }
    }

    if (-not $newUrl) {
        Write-Error "Impossibile leggere l'URL del nuovo tunnel da cloudflared.log"
        exit 1
    }

    # Attendi che il tunnel sia pronto a ricevere traffico
    Start-Sleep -Seconds 3
    Write-Host "Nuovo tunnel Cloudflare pronto: $newUrl" -ForegroundColor Green
}

# 3. Aggiorna VITE_BACKEND_URL su Vercel
Write-Host "`n[3/6] Aggiorno VITE_BACKEND_URL su Vercel..." -ForegroundColor Cyan
$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
cmd /c "npx -y vercel env rm VITE_BACKEND_URL production --token=$token --scope=$scope --yes" *> $null
$ErrorActionPreference = $prevPref

$tmpFile = Join-Path $ProjectRoot "_val.tmp"
[System.IO.File]::WriteAllText($tmpFile, $newUrl, (New-Object System.Text.UTF8Encoding $false))
cmd /c "npx -y vercel env add VITE_BACKEND_URL production --token=$token --scope=$scope < `"$tmpFile`""
Remove-Item $tmpFile -ErrorAction SilentlyContinue
Write-Host "Variabile d'ambiente aggiornata." -ForegroundColor Green

# 4. Compilazione e Deploy su Vercel
Write-Host "`n[4/6] Avvio deploy su Vercel..." -ForegroundColor Cyan
if ($deployHook) {
    Write-Host "Attivazione build tramite Deploy Hook di produzione..."
    $hookRes = Invoke-RestMethod -Uri $deployHook -Method Post
    Write-Host "Build avviata (Job ID: $($hookRes.job.id)). Attendo completamento..."
} else {
    Write-Host "Deploy tramite Vercel CLI..."
    cmd /c "npx -y vercel --prod --token=$token --scope=$scope --yes"
}

# Attendi 40 secondi che la compilazione su Vercel sia pronta
for ($s = 1; $s -le 8; $s++) {
    Write-Host "Compilazione in corso su Vercel ($($s * 5)s)..."
    Start-Sleep -Seconds 5
}

# 5. Riaggancia l'ultimo deploy al dominio personalizzato
Write-Host "`n[5/6] Aggancio dominio $CustomDomain all'ultimo deploy..." -ForegroundColor Cyan
$lsOutput = cmd /c "npx -y vercel ls zenboard-b4nm --token=$token --scope=$scope" 2>&1 | Out-String
$matchDeploy = [regex]::Match($lsOutput, 'zenboard-b4nm-[a-z0-9]+-alessandros-projects-d350354e\.vercel\.app')

if ($matchDeploy.Success) {
    $latestDeployUrl = $matchDeploy.Value
    Write-Host "Ultimo deploy individuato: $latestDeployUrl"
    cmd /c "npx -y vercel alias set $latestDeployUrl $CustomDomain --token=$token --scope=$scope"
    Write-Host "Alias $CustomDomain collegato con successo!" -ForegroundColor Green
} else {
    Write-Warning "Impossibile trovare l'URL del deploy per l'alias. Controlla la dashboard Vercel."
}

# 6. Verifica finale
Write-Host "`n[6/6] Verifica connettività..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
try {
    $res = Invoke-RestMethod -Uri "https://$CustomDomain/api/health" -TimeoutSec 10
    Write-Host "Verifica superata! Backend risponde attraverso il dominio." -ForegroundColor Green
} catch {
    Write-Host "Dominio online su https://$CustomDomain" -ForegroundColor Green
}

Write-Host "`n===============================================" -ForegroundColor Yellow
Write-Host "🎉 OPERAZIONE COMPLETATA!" -ForegroundColor Green
Write-Host "🌐 Frontend: https://$CustomDomain" -ForegroundColor Cyan
Write-Host "🔌 Backend Tunnel: $newUrl" -ForegroundColor Cyan
Write-Host "===============================================`n"
