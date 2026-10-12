<#
  restart-tunnel.ps1
  ------------------
  Risolve il problema del tunnel Cloudflare "quick" che genera un URL
  nuovo ogni volta che si riavvia: con un solo comando,
    1. Ferma il vecchio tunnel (se attivo) e ne avvia uno nuovo
    2. Estrae il nuovo URL pubblico (*.trycloudflare.com)
    3. Aggiorna VITE_BACKEND_URL su Vercel con il nuovo URL
    4. Builda e pubblica il frontend direttamente via Vercel CLI
    5. Riaggancia il dominio personalizzato (zenboard.zenbyte.it) al nuovo deploy

  Uso: apri PowerShell nella cartella del progetto e lancia:
    .\restart-tunnel.ps1
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$EnvFile = Join-Path $ProjectRoot ".env"
$LogFile = Join-Path $ProjectRoot "cloudflared.log"
$CustomDomain = "zenboard.zenbyte.it"

if (-not (Test-Path $EnvFile)) {
    Write-Error "Non trovo il file .env in $ProjectRoot"
    exit 1
}

# Carica le variabili da .env (VERCEL_TOKEN, VERCEL_SCOPE, ...)
Get-Content $EnvFile | ForEach-Object {
    if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$' -and $_ -notmatch '^\s*#') {
        Set-Item -Path "env:$($Matches[1])" -Value $Matches[2]
    }
}

if (-not $env:VERCEL_TOKEN -or -not $env:VERCEL_SCOPE) {
    Write-Error "Mancano VERCEL_TOKEN o VERCEL_SCOPE nel file .env"
    exit 1
}

# 1. Verifica Docker Compose attivo (il tunnel punta a localhost:3001)
Write-Host "`n[1/6] Verifico il backend locale (porta 3001)..." -ForegroundColor Cyan
try {
    Invoke-RestMethod -Uri "http://localhost:3001/api/health" -TimeoutSec 5 | Out-Null
    Write-Host "Backend OK." -ForegroundColor Green
} catch {
    Write-Error "Il backend su localhost:3001 non risponde. Avvia prima 'docker compose up -d'."
    exit 1
}

# 2. Ferma eventuale tunnel precedente e avvia uno nuovo
Write-Host "`n[2/6] Riavvio il tunnel Cloudflare..." -ForegroundColor Cyan
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item $LogFile -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$cloudflaredPath = (Get-Command cloudflared -ErrorAction SilentlyContinue).Source
if (-not $cloudflaredPath) {
    $env:PATH += ";C:\Program Files (x86)\cloudflared;C:\Program Files\cloudflared"
    $cloudflaredPath = "cloudflared"
}
Start-Process -FilePath $cloudflaredPath -ArgumentList "tunnel --url http://localhost:3001 --logfile `"$LogFile`"" -WindowStyle Hidden

$newUrl = $null
for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 1
    if (Test-Path $LogFile) {
        $match = Select-String -Path $LogFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -First 1
        if ($match) { $newUrl = $match.Matches[0].Value; break }
    }
}
if (-not $newUrl) {
    Write-Error "Non sono riuscito a leggere il nuovo URL del tunnel dal log."
    exit 1
}
Write-Host "Nuovo URL tunnel: $newUrl" -ForegroundColor Green

Start-Sleep -Seconds 2
try {
    Invoke-RestMethod -Uri "$newUrl/api/health" -TimeoutSec 10 | Out-Null
    Write-Host "Tunnel verificato e funzionante." -ForegroundColor Green
} catch {
    Write-Warning "Il tunnel non risponde ancora, potrebbe servire qualche secondo in piu'. Procedo comunque."
}

# 3. Aggiorna la variabile d'ambiente su Vercel
#    (scritta su file SENZA BOM e passata via redirect cmd, altrimenti PowerShell
#     inietta un BOM invisibile a inizio stringa quando fa da ponte verso processi esterni)
Write-Host "`n[3/6] Aggiorno VITE_BACKEND_URL su Vercel..." -ForegroundColor Cyan
Set-Location $ProjectRoot

$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"
vercel env rm VITE_BACKEND_URL production --token=$env:VERCEL_TOKEN --scope=$env:VERCEL_SCOPE --yes *> $null
$ErrorActionPreference = $prevPref

$tmpFile = Join-Path $ProjectRoot "_tunnel_url.tmp"
[System.IO.File]::WriteAllText($tmpFile, $newUrl, (New-Object System.Text.UTF8Encoding $false))
cmd /c "vercel env add VITE_BACKEND_URL production --token=$($env:VERCEL_TOKEN) --scope=$($env:VERCEL_SCOPE) < `"$tmpFile`""
Remove-Item $tmpFile -ErrorAction SilentlyContinue
Write-Host "Variabile aggiornata." -ForegroundColor Green

# 4. Builda e pubblica il frontend direttamente (CLI, non dipende da GitHub: niente rate-limit)
Write-Host "`n[4/6] Deploy in corso (puo' richiedere 1-2 minuti)..." -ForegroundColor Cyan
$deployOutput = vercel --prod --token=$env:VERCEL_TOKEN --scope=$env:VERCEL_SCOPE --yes 2>&1 | Out-String

$deployedUrlMatch = [regex]::Match($deployOutput, 'zenboard-b4nm-[a-z0-9]+-alessandros-projects-d350354e\.vercel\.app')
if (-not $deployedUrlMatch.Success) {
    Write-Host $deployOutput
    Write-Error "Non sono riuscito a individuare l'URL del nuovo deploy. Controlla l'output sopra."
    exit 1
}
$deployedUrl = $deployedUrlMatch.Value
Write-Host "Deploy pubblicato: $deployedUrl" -ForegroundColor Green

# 5. Riaggancia il dominio personalizzato al nuovo deploy
Write-Host "`n[5/6] Aggancio $CustomDomain al nuovo deploy..." -ForegroundColor Cyan
vercel alias set $deployedUrl $CustomDomain --token=$env:VERCEL_TOKEN --scope=$env:VERCEL_SCOPE

# 6. Verifica finale
Write-Host "`n[6/6] Verifica finale..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
try {
    $html = Invoke-WebRequest -Uri "https://$CustomDomain/" -TimeoutSec 15 -UseBasicParsing
    if ($html.Content -match $newUrl.Replace('/', '\/')) {
        Write-Host "Verifica OK: il sito pubblica l'URL tunnel corretto." -ForegroundColor Green
    } else {
        Write-Warning "Il sito e' online ma non sono riuscito a confermare l'URL nel bundle (puo' essere cache del browser: prova un hard refresh)."
    }
} catch {
    Write-Warning "Verifica finale non riuscita: $($_.Exception.Message)"
}

Write-Host "`n=== FATTO ===" -ForegroundColor Yellow
Write-Host "Backend pubblico : $newUrl"
Write-Host "Frontend online  : https://$CustomDomain"
