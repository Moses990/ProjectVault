param(
    [Parameter(Mandatory = $true)]
    [int]$Port
)

$ErrorActionPreference = "Stop"
$listener = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
$listener.Start()

try {
    while ($true) {
        $client = $listener.AcceptTcpClient()
        try {
            $stream = $client.GetStream()
            $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8, $false, 4096, $true)
            $requestLine = $reader.ReadLine()
            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }
            while ($true) {
                $line = $reader.ReadLine()
                if ([string]::IsNullOrEmpty($line)) {
                    break
                }
            }

            $path = ($requestLine -split ' ')[1]
            $status = "200 OK"
            if ($path -like "*/models") {
                $body = @{ data = @(@{ id = "fixture-model" }) } | ConvertTo-Json -Depth 6 -Compress
            }
            elseif ($path -like "*/chat/completions") {
                $content = @{
                    summary = "AI packaged draft packagebeta"
                    core_needs = @("控制顾客动线")
                    special_reqs = @("夜间施工")
                    risks = @("交付周期紧")
                    lessons = @("提前冻结材料样板")
                    tags = @("packagebeta", "fixture")
                } | ConvertTo-Json -Depth 8 -Compress
                $body = @{
                    choices = @(@{ message = @{ content = $content } })
                } | ConvertTo-Json -Depth 8 -Compress
            }
            else {
                $status = "404 Not Found"
                $body = @{ error = "not_found" } | ConvertTo-Json -Compress
            }

            $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
            $headers = "HTTP/1.1 $status`r`nContent-Type: application/json; charset=utf-8`r`nContent-Length: $($bytes.Length)`r`nConnection: close`r`n`r`n"
            $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($headerBytes, 0, $headerBytes.Length)
            $stream.Write($bytes, 0, $bytes.Length)
            $stream.Flush()
        }
        finally {
            $client.Close()
        }
    }
}
finally {
    $listener.Stop()
}
