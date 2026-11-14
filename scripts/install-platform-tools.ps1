param(
  [Parameter(Mandatory = $true)]
  [string]$Destination
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) (
  "luna-platform-tools-" + [Guid]::NewGuid().ToString('N')
)
$archivePath = Join-Path $temporaryDirectory 'platform-tools.zip'
$extractionDirectory = Join-Path $temporaryDirectory 'extracted'
$stagedToolsDirectory = Join-Path $extractionDirectory 'platform-tools'
$destinationDirectory = [IO.Path]::GetFullPath($Destination)
$backupDirectory = "$destinationDirectory.backup-$([Guid]::NewGuid().ToString('N'))"
$destinationBackedUp = $false

try {
  New-Item -ItemType Directory -Path $extractionDirectory -Force | Out-Null
  Invoke-WebRequest `
    -Uri 'https://dl.google.com/android/repository/platform-tools-latest-windows.zip' `
    -OutFile $archivePath `
    -MaximumRedirection 5

  if ((Get-Item -LiteralPath $archivePath).Length -gt 100MB) {
    throw 'The Android Platform Tools archive exceeds the download size limit.'
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractionDirectory -Force
  $stagedAdbPath = Join-Path $stagedToolsDirectory 'adb.exe'
  if (-not (Test-Path -LiteralPath $stagedAdbPath -PathType Leaf)) {
    throw 'The downloaded Platform Tools archive does not contain ADB.'
  }

  & $stagedAdbPath version | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'The downloaded ADB executable failed its version check.'
  }

  $destinationParent = Split-Path -Parent $destinationDirectory
  New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  if (Test-Path -LiteralPath $destinationDirectory) {
    Move-Item -LiteralPath $destinationDirectory -Destination $backupDirectory
    $destinationBackedUp = $true
  }

  try {
    Move-Item -LiteralPath $stagedToolsDirectory -Destination $destinationDirectory
    $installedAdbPath = Join-Path $destinationDirectory 'adb.exe'
    & $installedAdbPath version | Out-Null
    if ($LASTEXITCODE -ne 0) {
      throw 'The installed ADB executable failed its version check.'
    }
  }
  catch {
    if (Test-Path -LiteralPath $destinationDirectory) {
      Remove-Item -LiteralPath $destinationDirectory -Recurse -Force
    }
    if ($destinationBackedUp) {
      Move-Item -LiteralPath $backupDirectory -Destination $destinationDirectory
      $destinationBackedUp = $false
    }
    throw
  }

  if ($destinationBackedUp) {
    Remove-Item -LiteralPath $backupDirectory -Recurse -Force
    $destinationBackedUp = $false
  }
}
finally {
  if (Test-Path -LiteralPath $temporaryDirectory) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
}
