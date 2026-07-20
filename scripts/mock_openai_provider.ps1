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
            $headerBytes = New-Object System.Collections.Generic.List[byte]
            while ($headerBytes.Count -lt 65536) {
                $value = $stream.ReadByte()
                if ($value -lt 0) { break }
                $headerBytes.Add([byte]$value)
                $count = $headerBytes.Count
                if ($count -ge 4 -and
                    $headerBytes[$count - 4] -eq 13 -and
                    $headerBytes[$count - 3] -eq 10 -and
                    $headerBytes[$count - 2] -eq 13 -and
                    $headerBytes[$count - 1] -eq 10) {
                    break
                }
            }
            $headerText = [System.Text.Encoding]::ASCII.GetString($headerBytes.ToArray())
            $headerLines = $headerText -split "`r`n"
            $requestLine = $headerLines[0]
            if ([string]::IsNullOrWhiteSpace($requestLine)) {
                continue
            }

            $contentLength = 0
            foreach ($line in $headerLines) {
                if ($line -match '^Content-Length:\s*(\d+)$') {
                    $contentLength = [int]$Matches[1]
                }
            }
            if ($contentLength -gt 0) {
                $requestBody = New-Object byte[] $contentLength
                $offset = 0
                while ($offset -lt $contentLength) {
                    $read = $stream.Read($requestBody, $offset, $contentLength - $offset)
                    if ($read -le 0) { break }
                    $offset += $read
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
                    core_needs = @("control customer circulation")
                    special_reqs = @("night construction")
                    risks = @("tight delivery schedule")
                    lessons = @("freeze material samples early")
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
            $responseHeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($headers)
            $stream.Write($responseHeaderBytes, 0, $responseHeaderBytes.Length)
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
