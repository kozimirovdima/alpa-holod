# Локальный статический сервер для предпросмотра сайта (без Node.js и Python).
# Запуск:  powershell -ExecutionPolicy Bypass -File tools\serve.ps1 -Port 8123
# Или двойным кликом по start-website.cmd в корне проекта.

param(
    [int]$Port = 8123
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $root "index.html"))) {
    $root = $PSScriptRoot
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")

try {
    $listener.Start()
} catch {
    Write-Host "Не удалось занять порт $Port. Возможно, сервер уже запущен." -ForegroundColor Yellow
    exit 1
}

$types = @{
    ".html"  = "text/html; charset=utf-8"
    ".htm"   = "text/html; charset=utf-8"
    ".css"   = "text/css; charset=utf-8"
    ".js"    = "application/javascript; charset=utf-8"
    ".json"  = "application/json; charset=utf-8"
    ".svg"   = "image/svg+xml"
    ".png"   = "image/png"
    ".jpg"   = "image/jpeg"
    ".jpeg"  = "image/jpeg"
    ".webp"  = "image/webp"
    ".gif"   = "image/gif"
    ".ico"   = "image/x-icon"
    ".woff"  = "font/woff"
    ".woff2" = "font/woff2"
    ".pdf"   = "application/pdf"
    ".txt"   = "text/plain; charset=utf-8"
}

Write-Host ""
Write-Host "  Альфа-Холод — локальный сервер" -ForegroundColor Cyan
Write-Host "  Папка: $root"
Write-Host "  Адрес: http://localhost:$Port/"
Write-Host "  Остановить: Ctrl+C"
Write-Host ""

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)

        if ($path -eq "/" -or $path -eq "") {
            $path = "/index.html"
        }

        $relative = ($path.TrimStart("/")) -replace "/", [System.IO.Path]::DirectorySeparatorChar
        $file = Join-Path $root $relative

        if (Test-Path -LiteralPath $file -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()

            # Локальный сервер не выполняет PHP: не отдаём исходник скрипта.
            if ($ext -eq ".php") {
                $ctx.Response.StatusCode = 501
                $ctx.Response.ContentType = "application/json; charset=utf-8"
                $msg = [System.Text.Encoding]::UTF8.GetBytes(
                    '{"ok":false,"error":"php_not_supported"}'
                )
                $ctx.Response.ContentLength64 = $msg.Length
                $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
                $ctx.Response.OutputStream.Close()
                continue
            }

            if ($types.ContainsKey($ext)) {
                $ctx.Response.ContentType = $types[$ext]
            } else {
                $ctx.Response.ContentType = "application/octet-stream"
            }

            $bytes = [System.IO.File]::ReadAllBytes($file)
            $ctx.Response.ContentLength64 = $bytes.Length
            $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $ctx.Response.StatusCode = 404
            $ctx.Response.ContentType = "text/html; charset=utf-8"
            $msg = [System.Text.Encoding]::UTF8.GetBytes(
                "<h1>404</h1><p>Файл не найден: $path</p><p><a href='/'>На главную</a></p>"
            )
            $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
        }

        $ctx.Response.OutputStream.Close()
    } catch {
        # Клиент закрыл соединение — продолжаем работу.
    }
}
