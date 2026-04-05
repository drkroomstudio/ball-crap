$port = if ($env:PORT) { $env:PORT } else { "3001" }
Write-Host "Server running at http://localhost:$port/"
[Console]::Out.Flush()
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
$listener.Start()
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
while ($listener.IsListening) {
    $context = $listener.GetContext()
    $path = $context.Request.Url.LocalPath
    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $root $path.Replace("/","\")
    if (Test-Path $file) {
        $ext = [IO.Path]::GetExtension($file)
        $mime = @{".html"="text/html";".css"="text/css";".js"="application/javascript";".json"="application/json";".ico"="image/x-icon"}
        $context.Response.ContentType = if ($mime[$ext]) { $mime[$ext] } else { "application/octet-stream" }
        $bytes = [IO.File]::ReadAllBytes($file)
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $context.Response.StatusCode = 404
    }
    $context.Response.Close()
}
