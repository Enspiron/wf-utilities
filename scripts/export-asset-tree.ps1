<#
.SYNOPSIS
Exports a read-only file tree report for an extracted asset folder.

.DESCRIPTION
Scans a target folder and writes a shareable text report with:
- root path
- directory/file counts
- extension summary
- ASCII file tree

The script only reads the target folder. It refuses to place the output report
inside the scanned root so the asset dump is not modified.

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\scripts\export-asset-tree.ps1 -Root "E:\WFDatamine\output\assets"

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\scripts\export-asset-tree.ps1 -Root "E:\WFDatamine\output\assets" -OutputPath ".\asset-tree.txt" -IncludeSizes

.EXAMPLE
powershell -ExecutionPolicy Bypass -File .\scripts\export-asset-tree.ps1 -Root "E:\WFDatamine\output\assets" -MaxDepth 4
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [string]$Root,

  [string]$OutputPath = ".\asset-tree.txt",

  [int]$MaxDepth = 0,

  [switch]$IncludeSizes,

  [switch]$IncludeModified
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-FullPath {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  if ([System.IO.Path]::IsPathRooted($PathValue)) {
    return [System.IO.Path]::GetFullPath($PathValue)
  }

  return [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $PathValue))
}

function Add-TrailingSeparator {
  param([Parameter(Mandatory = $true)][string]$PathValue)

  $trimmed = $PathValue.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
  return "$trimmed$([System.IO.Path]::DirectorySeparatorChar)"
}

function Format-ByteSize {
  param([Parameter(Mandatory = $true)][long]$Bytes)

  if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
  if ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
  if ($Bytes -ge 1KB) { return "{0:N1} KB" -f ($Bytes / 1KB) }
  return "$Bytes B"
}

function Get-FileExtensionKey {
  param([Parameter(Mandatory = $true)][System.IO.FileInfo]$File)

  if ([string]::IsNullOrWhiteSpace($File.Extension)) {
    return "(no extension)"
  }

  return $File.Extension.ToLowerInvariant()
}

$rootItem = Get-Item -LiteralPath $Root -Force
if (-not $rootItem.PSIsContainer) {
  throw "Root must be a directory: $Root"
}

$rootFullPath = Get-FullPath $rootItem.FullName
$outputFullPath = Get-FullPath $OutputPath
$rootWithSeparator = Add-TrailingSeparator $rootFullPath

if (
  $outputFullPath.Equals($rootFullPath, [System.StringComparison]::OrdinalIgnoreCase) -or
  $outputFullPath.StartsWith($rootWithSeparator, [System.StringComparison]::OrdinalIgnoreCase)
) {
  throw "OutputPath is inside the scanned root. Choose a path outside '$rootFullPath'."
}

$outputDirectory = Split-Path -Parent $outputFullPath
if (-not [string]::IsNullOrWhiteSpace($outputDirectory) -and -not (Test-Path -LiteralPath $outputDirectory)) {
  New-Item -ItemType Directory -Path $outputDirectory | Out-Null
}

$tree = [System.Text.StringBuilder]::new()
$errors = [System.Collections.Generic.List[string]]::new()
$extensionCounts = @{}
$extensionBytes = @{}
$script:DirectoryCount = 1
$script:FileCount = 0
$script:TotalBytes = 0L

function Add-ExtensionStats {
  param([Parameter(Mandatory = $true)][System.IO.FileInfo]$File)

  $key = Get-FileExtensionKey $File
  if (-not $extensionCounts.ContainsKey($key)) {
    $extensionCounts[$key] = 0
    $extensionBytes[$key] = 0L
  }

  $extensionCounts[$key] = [int]$extensionCounts[$key] + 1
  $extensionBytes[$key] = [long]$extensionBytes[$key] + $File.Length
}

function Get-DisplayName {
  param([Parameter(Mandatory = $true)][System.IO.FileSystemInfo]$Item)

  $name = $Item.Name
  if ($Item.PSIsContainer) {
    return "$name/"
  }

  $parts = [System.Collections.Generic.List[string]]::new()
  if ($IncludeSizes) {
    $parts.Add((Format-ByteSize ([System.IO.FileInfo]$Item).Length))
  }
  if ($IncludeModified) {
    $parts.Add($Item.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss"))
  }

  if ($parts.Count -eq 0) {
    return $name
  }

  return "$name [$($parts -join ', ')]"
}

function Write-Tree {
  param(
    [Parameter(Mandatory = $true)][System.IO.DirectoryInfo]$Directory,
    [Parameter(Mandatory = $true)][AllowEmptyString()][string]$Prefix,
    [Parameter(Mandatory = $true)][int]$Depth
  )

  if ($MaxDepth -gt 0 -and $Depth -ge $MaxDepth) {
    [void]$tree.AppendLine("$Prefix+-- ...")
    return
  }

  try {
    $children = @(Get-ChildItem -LiteralPath $Directory.FullName -Force | Sort-Object @{ Expression = { -not $_.PSIsContainer } }, Name)
  } catch {
    $message = "$($Directory.FullName): $($_.Exception.Message)"
    $errors.Add($message)
    [void]$tree.AppendLine("$Prefix+-- [could not read directory]")
    return
  }

  for ($index = 0; $index -lt $children.Count; $index += 1) {
    $child = $children[$index]
    $isLast = $index -eq ($children.Count - 1)
    $branch = if ($isLast) { "+-- " } else { "+-- " }
    $nextPrefix = if ($isLast) { "$Prefix    " } else { "$Prefix|   " }

    [void]$tree.AppendLine("$Prefix$branch$(Get-DisplayName $child)")

    if ($child.PSIsContainer) {
      $script:DirectoryCount += 1
      Write-Tree -Directory ([System.IO.DirectoryInfo]$child) -Prefix $nextPrefix -Depth ($Depth + 1)
    } else {
      $file = [System.IO.FileInfo]$child
      $script:FileCount += 1
      $script:TotalBytes += $file.Length
      Add-ExtensionStats $file
    }
  }
}

[void]$tree.AppendLine("$(Split-Path -Leaf $rootFullPath)/")
Write-Tree -Directory ([System.IO.DirectoryInfo]$rootItem) -Prefix "" -Depth 0

$report = [System.Text.StringBuilder]::new()
[void]$report.AppendLine("# Asset Tree Report")
[void]$report.AppendLine("Generated: $((Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz'))")
[void]$report.AppendLine("Root: $rootFullPath")
[void]$report.AppendLine("MaxDepth: $(if ($MaxDepth -gt 0) { $MaxDepth } else { 'unlimited' })")
[void]$report.AppendLine("")
[void]$report.AppendLine("## Counts")
[void]$report.AppendLine("Directories: $script:DirectoryCount")
[void]$report.AppendLine("Files: $script:FileCount")
[void]$report.AppendLine("Total file bytes: $script:TotalBytes ($(Format-ByteSize $script:TotalBytes))")
[void]$report.AppendLine("")
[void]$report.AppendLine("## Extensions")

if ($extensionCounts.Count -eq 0) {
  [void]$report.AppendLine("(no files)")
} else {
  $extensionCounts.Keys |
    Sort-Object |
    ForEach-Object {
      $count = [int]$extensionCounts[$_]
      $bytes = [long]$extensionBytes[$_]
      [void]$report.AppendLine("$($_)`t$count`t$bytes`t$(Format-ByteSize $bytes)")
    }
}

if ($errors.Count -gt 0) {
  [void]$report.AppendLine("")
  [void]$report.AppendLine("## Read Errors")
  foreach ($entry in $errors) {
    [void]$report.AppendLine($entry)
  }
}

[void]$report.AppendLine("")
[void]$report.AppendLine("## Tree")
[void]$report.Append($tree.ToString())

[System.IO.File]::WriteAllText($outputFullPath, $report.ToString(), [System.Text.UTF8Encoding]::new($false))

Write-Host "Wrote asset tree report:"
Write-Host $outputFullPath
Write-Host "Directories: $script:DirectoryCount"
Write-Host "Files: $script:FileCount"
Write-Host "Bytes: $script:TotalBytes ($(Format-ByteSize $script:TotalBytes))"
