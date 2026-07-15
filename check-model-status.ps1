# ==============================================================================
# SKRIP POWERSHELL: CEK STATUS MODEL HIDEPULSA AI (V5 - RUNSPACE PARALLEL FOR PS 5.1)
# ==============================================================================

# 1. Konfigurasi API
$ApiKey = "sk-kr-sf2voGpc5wfV9UAAy6BAxP6EYSf5Vdd3"
$Endpoint = "https://ai.hidepulsa.com/v1/chat/completions"

# 2. Daftar 38 Model Resmi
$Models = @{
    "Claude (Anthropic)" = @(
        "kr/claude-sonnet-5", "kr/claude-opus-4.8-thinking-agentic", "kr/claude-opus-4.8-thinking",
        "kr/claude-opus-4.8", "kr/claude-opus-4.7", "kr/claude-opus-4.6", "kr/claude-opus-4.5",
        "ag/claude-opus-4-6-thinking", "kr/claude-sonnet-4.6", "ag/claude-sonnet-4-6",
        "kr/claude-sonnet-4.5-thinking-agentic", "kr/claude-sonnet-4.5-thinking",
        "kr/claude-sonnet-4.5-agentic", "kr/claude-sonnet-4.5", "kr/claude-sonnet-4",
        "kr/claude-haiku-4.5-thinking-agentic", "kr/claude-haiku-4.5-thinking",
        "kr/claude-haiku-4.5-agentic", "kr/claude-haiku-4.5"
    );
    "Gemini (Google)" = @(
        "ag/gemini-pro-agent", "ag/gemini-3.1-pro-low", "ag/gemini-3-flash"
    );
    "DeepSeek" = @(
        "abb/deepseek-v4-pro", "abb/deepseek-v4-flash", "kr/deepseek-3.2"
    );
    "Qwen (Alibaba)" = @(
        "abb/qwen3.7-max", "abb/qwen3.7-max-2026-05-17", "abb/qwen3.7-max-preview",
        "abb/qwen3.6-max-preview", "abb/qwen3.6-plus", "abb/qwen3.6-flash",
        "abb/qwen3.5-plus", "abb/qwen3.5-flash", "kr/qwen3-coder-next"
    );
    "GLM & MiniMax" = @(
        "abb/glm-5.2", "abb/glm-5.1", "kr/glm-5", "kr/MiniMax-M2.5"
    )
}

# 3. Meratakan data model ke dalam antrean tunggal
$TaskList = @()
foreach ($Category in $Models.Keys) {
    foreach ($Model in $Models[$Category]) {
        $TaskList += [PSCustomObject]@{
            Category = $Category
            ModelId  = $Model
        }
    }
}

Clear-Host
Write-Host "=== Memulai Pengecekan 38 Model Bersamaan (PS 5.1 Runspace) ===" -ForegroundColor Cyan
Write-Host "Memproses..." -ForegroundColor Gray

# 4. Inisialisasi RunspacePool (Maksimal 15 thread berjalan bersamaan)
$MaxThreads = 15
$RunspacePool = [runspacefactory]::CreateRunspacePool(1, $MaxThreads)
$RunspacePool.Open()

# Blok kode yang akan dieksekusi di setiap thread
$ScriptBlock = {
    param($Model, $Category, $ApiKey, $Endpoint)

    $Headers = @{
        "Authorization" = "Bearer $ApiKey"
        "Content-Type"  = "application/json"
    }

    $CurrentBody = @{
        model = $Model
        messages = @( @{ role = "user"; content = "Ping" } )
        max_tokens = 5
    } | ConvertTo-Json -Compress

    $StartTime = Get-Date
    $Status = "UNKNOWN"
    $Duration = 0
    $Details = ""

    try {
        $Response = Invoke-RestMethod -Uri $Endpoint -Method Post -Headers $Headers -Body $CurrentBody -TimeoutSec 15
        $EndTime = Get-Date
        $Duration = [Math]::Round(($EndTime - $StartTime).TotalMilliseconds)

        if ($Response.choices) {
            $Status = "ONLINE"
        }
    }
    catch {
        $RawError = $_
        if ($RawError.Exception -and $RawError.Exception.Response) {
            $StatusCode = [Int]$RawError.Exception.Response.StatusCode
            $Status = "ERROR HTTP $StatusCode"
            try {
                $ResponseStream = $RawError.Exception.Response.GetResponseStream()
                $ReadStream = New-Object System.IO.StreamReader($ResponseStream)
                $Details = $ReadStream.ReadToEnd()
                $ReadStream.Close()
            } catch { $Details = $RawError.Exception.Message }
        } else {
            $Status = "TIMEOUT/KONEKSI"
            $Details = $RawError.Exception.Message
        }
    }

    # Output objek hasil thread
    [PSCustomObject]@{
        Category   = $Category
        ModelId    = $Model
        Status     = $Status
        DurationMs = $Duration
        Details    = $Details
    }
}

# 5. Menjalankan semua task ke dalam RunspacePool
$Jobs = @()
foreach ($Task in $TaskList) {
    $PowerShell = [powershell]::Create().AddScript($ScriptBlock)
    $PowerShell.AddArgument($Task.ModelId) | Out-Null
    $PowerShell.AddArgument($Task.Category) | Out-Null
    $PowerShell.AddArgument($ApiKey) | Out-Null
    $PowerShell.AddArgument($Endpoint) | Out-Null
    $PowerShell.RunspacePool = $RunspacePool
    
    $Jobs += [PSCustomObject]@{
        Instance = $PowerShell
        Handle   = $PowerShell.BeginInvoke()
    }
}

# 6. Menunggu dan mengumpulkan semua hasil
$Results = @()
foreach ($Job in $Jobs) {
    $Results += $Job.Instance.EndInvoke($Job.Handle)
    $Job.Instance.Dispose()
}

# Tutup pool setelah selesai
$RunspacePool.Close()
$RunspacePool.Dispose()

# 7. Tampilkan Hasil Akhir yang Sudah Dikelompokkan Kembali
Write-Host "`n=== HASIL PENGECEKAN STATUS MODEL ===" -ForegroundColor Cyan

$GroupedResults = $Results | Group-Object Category
foreach ($Group in $GroupedResults) {
    Write-Host "`nKeluarga Model: $($Group.Name)" -ForegroundColor Yellow
    Write-Host "----------------------------------------" -ForegroundColor Yellow
    
    foreach ($Item in $Group.Group) {
        if ($Item.Status -eq "ONLINE") {
            Write-Host "[ONLINE] " -ForegroundColor Green -NoNewline
            Write-Host "$($Item.ModelId) " -NoNewline
            Write-Host "($($Item.DurationMs) ms)" -ForegroundColor Gray
        } else {
            Write-Host "[$($Item.Status)] " -ForegroundColor Red -NoNewline
            Write-Host "$($Item.ModelId)" -ForegroundColor White
            if ($Item.Details) {
                Write-Host "  -> Detail: $($Item.Details)" -ForegroundColor DarkGray
            }
        }
    }
}

Write-Host "`n=== Semua Pengecekan Selesai ===" -ForegroundColor Cyan