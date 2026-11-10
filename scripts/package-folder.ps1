$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$source = [IO.Path]::GetFullPath((Join-Path $workspace 'program\win-unpacked'))
$destination = [IO.Path]::GetFullPath((Join-Path $workspace 'program\WTG-KMZ-Generator-Folder-0.1.0-x64.zip'))
if (-not $source.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar) -or -not $destination.StartsWith($workspace + [IO.Path]::DirectorySeparatorChar)) { throw 'Unexpected output path' }
if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination }
[IO.Compression.ZipFile]::CreateFromDirectory($source, $destination, [IO.Compression.CompressionLevel]::Fastest, $false)
Write-Output $destination
