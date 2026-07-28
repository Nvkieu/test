<#
    Máy chủ web nhỏ để chạy app trên Windows mà không cần cài thêm gì.

    Vì sao cần máy chủ: mở thẳng index.html bằng file:// thì trình duyệt chặn
    fetch dữ liệu bài học và không cho đăng ký service worker. Chạy qua
    http://localhost thì cả hai đều hoạt động — và localhost được coi là
    "secure context" nên bạn cài được app lên máy luôn.

    Chỉ lắng nghe trên localhost, không mở ra mạng LAN, nên Windows Firewall
    không hỏi gì cả.

    Dùng: bấm đúp run-windows.bat ở thư mục gốc, hoặc
          powershell -ExecutionPolicy Bypass -File scripts\serve.ps1
#>

[CmdletBinding()]
param(
    [int]$Port = 8765,
    [switch]$NoBrowser
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch { }

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$rootPrefix = $root.TrimEnd('\') + '\'

if (-not (Test-Path (Join-Path $root 'index.html'))) {
    Write-Host "Không tìm thấy index.html trong $root" -ForegroundColor Red
    Write-Host "Hãy chạy script này từ trong thư mục dự án." -ForegroundColor Red
    exit 1
}

$mime = @{
    '.html'        = 'text/html; charset=utf-8'
    '.js'          = 'text/javascript; charset=utf-8'
    '.mjs'         = 'text/javascript; charset=utf-8'
    '.css'         = 'text/css; charset=utf-8'
    '.json'        = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json; charset=utf-8'
    '.svg'         = 'image/svg+xml'
    '.png'         = 'image/png'
    '.ico'         = 'image/x-icon'
    '.txt'         = 'text/plain; charset=utf-8'
    '.md'          = 'text/markdown; charset=utf-8'
}

# Cổng có thể đang bận — thử vài cổng liền kề rồi mới chịu thua.
$listener = $null
$chosenPort = 0
$lastError = $null
foreach ($p in $Port..($Port + 10)) {
    $candidate = New-Object System.Net.HttpListener
    try {
        $candidate.Prefixes.Add("http://localhost:$p/")
        $candidate.Start()
        $listener = $candidate
        $chosenPort = $p
        break
    } catch {
        $lastError = $_
        $candidate.Close()
    }
}

if (-not $listener) {
    Write-Host ''
    Write-Host "  Không mở được cổng nào trong khoảng $Port-$($Port + 10)." -ForegroundColor Red
    if ($lastError) {
        Write-Host "  Lỗi: $($lastError.Exception.Message)" -ForegroundColor Red
    }
    Write-Host ''
    Write-Host '  Nếu lỗi là "Access is denied", thử một trong hai cách:' -ForegroundColor Yellow
    Write-Host '    - Bấm chuột phải run-windows.bat > Run as administrator'
    Write-Host '    - Hoặc nếu máy đã có Python:  python -m http.server 8765 --bind 127.0.0.1'
    Write-Host ''
    exit 1
}

$url = "http://localhost:$chosenPort/"

Write-Host ''
Write-Host '  📚 Học tiếng Anh mỗi ngày' -ForegroundColor Cyan
Write-Host ''
Write-Host "  Đang chạy tại: $url" -ForegroundColor Green
Write-Host '  Bấm Ctrl+C ở cửa sổ này để dừng.'
Write-Host ''
Write-Host '  Muốn cài thành app: mở bằng Chrome hoặc Edge, rồi bấm biểu tượng'
Write-Host '  cài đặt ở cuối thanh địa chỉ (hoặc vào ⚙️ Cài đặt trong app).'
Write-Host ''

if (-not $NoBrowser) {
    try { Start-Process $url } catch { Write-Host "  (Không tự mở được trình duyệt, bạn mở tay giúp nhé.)" }
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        try {
            $path = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ($path -eq '/') { $path = '/index.html' }

            $relative = $path.TrimStart('/').Replace('/', '\')
            $full = [System.IO.Path]::GetFullPath((Join-Path $root $relative))

            # Chặn truy cập ra ngoài thư mục dự án (vd. ..\..\Windows\...).
            # So sánh với root + '\' chứ không phải root, nếu không thì thư mục
            # hàng xóm cùng tiền tố tên cũng lọt qua.
            if (-not $full.StartsWith($rootPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
                $response.StatusCode = 403
            } elseif (Test-Path -LiteralPath $full -PathType Leaf) {
                $bytes = [System.IO.File]::ReadAllBytes($full)
                $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
                $contentType = $mime[$ext]
                if (-not $contentType) { $contentType = 'application/octet-stream' }

                $response.ContentType = $contentType
                # Luôn hỏi lại máy chủ, để sửa file xong tải lại là thấy ngay.
                $response.Headers.Add('Cache-Control', 'no-cache')
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $body = [System.Text.Encoding]::UTF8.GetBytes('404 - khong tim thay file')
                $response.ContentType = 'text/plain; charset=utf-8'
                $response.ContentLength64 = $body.Length
                $response.OutputStream.Write($body, 0, $body.Length)
            }
        } catch {
            try { $response.StatusCode = 500 } catch { }
        } finally {
            try { $response.Close() } catch { }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
    Write-Host ''
    Write-Host '  Đã dừng máy chủ.' -ForegroundColor Yellow
}
