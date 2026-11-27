# =====================================================================
#  FourPane - 4분할 파일 탐색기 (폐쇄망용, 설치 불필요)
#  - Windows PowerShell 5.1 + WinForms (Windows 10/11 기본 탑재)
#  - 외부 네트워크 접속 없음, 외부 모듈 없음
#  - 설정 파일: %APPDATA%\FourPane\settings.json
#  - 오류 기록: %APPDATA%\FourPane\error.log
#
#  ※ 이 파일은 반드시 "UTF-8 (BOM)" 인코딩으로 저장해야 한글이 깨지지 않습니다.
# =====================================================================

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName Microsoft.VisualBasic

[System.Windows.Forms.Application]::EnableVisualStyles()

$script:AppDir   = Join-Path $env:APPDATA 'FourPane'
$script:Settings = Join-Path $script:AppDir 'settings.json'
$script:LogFile  = Join-Path $script:AppDir 'error.log'
if (-not (Test-Path $script:AppDir)) { [void](New-Item -ItemType Directory -Path $script:AppDir -Force) }

$script:Panes      = @()
$script:ActivePane = $null
$script:Favorites  = New-Object System.Collections.ArrayList
$script:UiFont     = New-Object System.Drawing.Font('Malgun Gothic', 9)
$script:MaxResults = 10000

function Write-Log([string]$msg) {
    try {
        $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
        Add-Content -Path $script:LogFile -Value $line -Encoding UTF8
    } catch { }
}

function Show-Error([string]$msg) {
    Write-Log $msg
    [void][System.Windows.Forms.MessageBox]::Show($msg, 'FourPane',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning)
}

# ---------------------------------------------------------------------
#  아이콘 (외부 파일 없이 직접 그림 + 확장자별 시스템 아이콘 캐시)
# ---------------------------------------------------------------------
$script:Images = New-Object System.Windows.Forms.ImageList
$script:Images.ColorDepth = [System.Windows.Forms.ColorDepth]::Depth32Bit
$script:Images.ImageSize  = New-Object System.Drawing.Size(16, 16)

function New-FolderBitmap {
    $bmp = New-Object System.Drawing.Bitmap(16, 16)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $tab  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(230, 180, 60))
    $body = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(250, 205, 90))
    $pen  = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(190, 140, 30))
    $g.FillRectangle($tab, 1, 3, 6, 3)
    $g.FillRectangle($body, 1, 5, 14, 9)
    $g.DrawRectangle($pen, 1, 5, 13, 8)
    $g.Dispose()
    return $bmp
}

function New-FileBitmap {
    $bmp = New-Object System.Drawing.Bitmap(16, 16)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.FillRectangle([System.Drawing.Brushes]::White, 3, 1, 10, 14)
    $g.DrawRectangle([System.Drawing.Pens]::Gray, 3, 1, 9, 13)
    $g.DrawLine([System.Drawing.Pens]::LightGray, 5, 5, 10, 5)
    $g.DrawLine([System.Drawing.Pens]::LightGray, 5, 8, 10, 8)
    $g.DrawLine([System.Drawing.Pens]::LightGray, 5, 11, 10, 11)
    $g.Dispose()
    return $bmp
}

$script:Images.Images.Add('__folder', (New-FolderBitmap))
$script:Images.Images.Add('__file',   (New-FileBitmap))

function Get-IconKey([System.IO.FileSystemInfo]$e) {
    if ($e -is [System.IO.DirectoryInfo]) { return '__folder' }
    $ext = $e.Extension.ToLowerInvariant()
    # 실행파일/바로가기는 파일마다 아이콘이 달라서 일반 아이콘 사용 (속도)
    if ($ext -eq '' -or $ext -in @('.exe', '.lnk', '.ico', '.url', '.scr')) { return '__file' }
    if ($script:Images.Images.ContainsKey($ext)) { return $ext }
    try {
        # UNC 경로(\\서버\...)는 ExtractAssociatedIcon 이 지원하지 않으므로 실패 시 일반 아이콘
        $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($e.FullName)
        if ($icon) { $script:Images.Images.Add($ext, $icon); return $ext }
    } catch { }
    return '__file'
}

# ---------------------------------------------------------------------
#  유틸리티
# ---------------------------------------------------------------------
function Format-Size([long]$bytes) {
    if ($bytes -lt 1KB) { return ('{0} B' -f $bytes) }
    if ($bytes -lt 1MB) { return ('{0:N0} KB' -f [math]::Ceiling($bytes / 1KB)) }
    if ($bytes -lt 1GB) { return ('{0:N1} MB' -f ($bytes / 1MB)) }
    return ('{0:N2} GB' -f ($bytes / 1GB))
}

function Test-Hidden([System.IO.FileSystemInfo]$e) {
    $a = $e.Attributes
    return (($a -band [System.IO.FileAttributes]::Hidden) -or ($a -band [System.IO.FileAttributes]::System))
}

function Resolve-UserPath([string]$path) {
    $p = $path.Trim().Trim('"')
    $p = [Environment]::ExpandEnvironmentVariables($p)
    if ($p -match '^[A-Za-z]:$') { $p = $p + '\' }
    return $p
}

function Get-ParentPath([System.IO.FileSystemInfo]$e) {
    if ($e -is [System.IO.DirectoryInfo]) {
        if ($e.Parent) { return $e.Parent.FullName } else { return '' }
    }
    return $e.DirectoryName
}

# ---------------------------------------------------------------------
#  목록 채우기 / 정렬
# ---------------------------------------------------------------------
function Get-SortKey([int]$col) {
    switch ($col) {
        1 { return { Get-ParentPath $_ } }
        2 { return { if ($_ -is [System.IO.DirectoryInfo]) { -1 } else { $_.Length } } }
        3 { return { $_.Extension } }
        4 { return { $_.LastWriteTime } }
        default { return { $_.Name } }
    }
}

function Fill-List($p) {
    $list = $p.List
    $key  = Get-SortKey $p.SortCol
    $dirs  = @($p.Entries | Where-Object { $_ -is [System.IO.DirectoryInfo] } | Sort-Object -Property $key -Descending:$p.SortDesc)
    $files = @($p.Entries | Where-Object { $_ -isnot [System.IO.DirectoryInfo] } | Sort-Object -Property $key -Descending:$p.SortDesc)

    $items = New-Object System.Collections.Generic.List[System.Windows.Forms.ListViewItem]
    foreach ($e in @($dirs + $files)) {
        if ($null -eq $e) { continue }
        $isDir = $e -is [System.IO.DirectoryInfo]
        $it = New-Object System.Windows.Forms.ListViewItem($e.Name)
        if ($p.Mode -eq 'search') { [void]$it.SubItems.Add((Get-ParentPath $e)) } else { [void]$it.SubItems.Add('') }
        if ($isDir) {
            [void]$it.SubItems.Add('')
            [void]$it.SubItems.Add('파일 폴더')
        } else {
            [void]$it.SubItems.Add((Format-Size $e.Length))
            $t = $e.Extension.TrimStart('.').ToUpperInvariant()
            if ($t) { [void]$it.SubItems.Add("$t 파일") } else { [void]$it.SubItems.Add('파일') }
        }
        [void]$it.SubItems.Add($e.LastWriteTime.ToString('yyyy-MM-dd HH:mm'))
        $it.ImageKey = Get-IconKey $e
        $it.Tag = $e
        $items.Add($it)
    }

    $list.BeginUpdate()
    $list.Items.Clear()
    if ($items.Count -gt 0) { $list.Items.AddRange($items.ToArray()) }
    if ($p.Mode -eq 'search') { $list.Columns[1].Width = 260 } else { $list.Columns[1].Width = 0 }
    $list.EndUpdate()
    Update-Status $p
}

function Update-Status($p, [string]$extra = '') {
    $d = 0; $f = 0
    foreach ($e in $p.Entries) { if ($e -is [System.IO.DirectoryInfo]) { $d++ } else { $f++ } }
    $sel = $p.List.SelectedItems.Count
    $txt = "폴더 $d · 파일 $f"
    if ($sel -gt 0) { $txt += " · 선택 $sel" }
    if ($p.Mode -eq 'search') { $txt = "검색 결과 - $txt" }
    if ($extra) { $txt += "   $extra" }
    $p.Status.Text = $txt
}

# ---------------------------------------------------------------------
#  이동 / 탐색
# ---------------------------------------------------------------------
function Navigate($p, [string]$path, [bool]$addHistory = $true) {
    $p.Stop = $true
    $p.SearchId++   # 진행 중인 검색이 있으면 결과를 버림
    $target = Resolve-UserPath $path
    if (-not $target) { return }

    $form.Cursor = [System.Windows.Forms.Cursors]::WaitCursor
    try {
        if (-not [System.IO.Directory]::Exists($target)) {
            $p.Address.Text = $p.Path
            Show-Error "경로를 열 수 없습니다.`n$target`n`n(네트워크 연결, 권한, 경로 철자를 확인해 주세요)"
            return
        }
        $di = New-Object System.IO.DirectoryInfo($target)
        $entries = New-Object System.Collections.ArrayList
        try {
            foreach ($d in $di.GetDirectories()) { if (-not (Test-Hidden $d)) { [void]$entries.Add($d) } }
            foreach ($f in $di.GetFiles())       { if (-not (Test-Hidden $f)) { [void]$entries.Add($f) } }
        } catch {
            Show-Error "폴더 내용을 읽을 수 없습니다.`n$target`n`n$($_.Exception.Message)"
            return
        }

        if ($addHistory -and $p.Path -and ($p.Path -ne $di.FullName)) { [void]$p.History.Add($p.Path) }
        $p.Path    = $di.FullName
        $p.Mode    = 'browse'
        $p.Entries = $entries
        $p.Address.Text = $p.Path
        Fill-List $p
    } finally {
        $form.Cursor = [System.Windows.Forms.Cursors]::Default
    }
}

function Go-Back($p) {
    if ($p.Mode -eq 'search') { Navigate $p $p.Path $false; return }
    if ($p.History.Count -gt 0) {
        $last = $p.History[$p.History.Count - 1]
        $p.History.RemoveAt($p.History.Count - 1)
        Navigate $p $last $false
    }
}

function Go-Up($p) {
    if ($p.Mode -eq 'search') { Navigate $p $p.Path $false; return }
    $di = New-Object System.IO.DirectoryInfo($p.Path)
    if ($di.Parent) { Navigate $p $di.Parent.FullName }
}

function Refresh-Pane($p) {
    if ($p.Mode -eq 'search') { Start-Search $p } else { Navigate $p $p.Path $false }
}

function Refresh-AllBrowsing {
    foreach ($q in $script:Panes) { if ($q.Mode -eq 'browse' -and $q.Path) { Navigate $q $q.Path $false } }
}

function Get-SelectedEntries($p) {
    $r = @()
    foreach ($it in $p.List.SelectedItems) { $r += $it.Tag }
    return ,$r
}

function Open-Entry($p, $e) {
    if ($e -is [System.IO.DirectoryInfo]) { Navigate $p $e.FullName; return }
    try { [void][System.Diagnostics.Process]::Start($e.FullName) }
    catch { Show-Error "파일을 열 수 없습니다.`n$($e.FullName)`n`n$($_.Exception.Message)" }
}

# ---------------------------------------------------------------------
#  검색 (파일/폴더 이름)
#   - 띄어쓰기로 여러 단어 입력 시 모두 포함하는 이름만 (AND)
#   - * ? 를 쓰면 와일드카드 패턴으로 그대로 사용
# ---------------------------------------------------------------------
function New-Matchers([string]$text) {
    $opt = [System.Management.Automation.WildcardOptions]::IgnoreCase
    $m = @()
    if ($text -match '[\*\?]') {
        $m += New-Object System.Management.Automation.WildcardPattern($text.Trim(), $opt)
    } else {
        foreach ($t in ($text -split '\s+')) {
            if ($t) {
                $esc = [System.Management.Automation.WildcardPattern]::Escape($t)
                $m += New-Object System.Management.Automation.WildcardPattern("*$esc*", $opt)
            }
        }
    }
    return ,$m
}

function Test-Match($matchers, [string]$name) {
    foreach ($w in $matchers) { if (-not $w.IsMatch($name)) { return $false } }
    return $true
}

function Start-Search($p) {
    $text = $p.SearchBox.Text.Trim()
    if (-not $text) { Navigate $p $p.Path $false; return }
    if (-not $p.Path) { return }
    $matchers = New-Matchers $text
    if ($matchers.Count -eq 0) { return }

    $results = New-Object System.Collections.ArrayList
    $root = New-Object System.IO.DirectoryInfo($p.Path)

    if (-not $p.Recurse.Checked) {
        try {
            foreach ($e in $root.GetFileSystemInfos()) {
                if (-not (Test-Hidden $e) -and (Test-Match $matchers $e.Name)) { [void]$results.Add($e) }
            }
        } catch { Show-Error $_.Exception.Message }
        $p.Mode = 'search'; $p.Entries = $results
        $p.Address.Text = $p.Path
        Fill-List $p
        return
    }

    # 하위 폴더까지 검색: 직접 순회 (권한 없는 폴더는 건너뜀)
    $p.SearchId++
    $myId = $p.SearchId
    $p.Stop = $false
    $p.SearchBtn.Enabled = $false
    $p.StopBtn.Enabled = $true
    $stack = New-Object System.Collections.Stack
    $stack.Push($root)
    $scanned = 0; $skipped = 0
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        while ($stack.Count -gt 0 -and -not $p.Stop -and $p.SearchId -eq $myId) {
            $dir = $stack.Pop()
            $scanned++
            try { $children = $dir.GetFileSystemInfos() } catch { $skipped++; continue }
            foreach ($e in $children) {
                if (Test-Hidden $e) { continue }
                if ($e -is [System.IO.DirectoryInfo]) {
                    # 정션/심볼릭 링크는 무한 반복 방지를 위해 들어가지 않음
                    if (-not ($e.Attributes -band [System.IO.FileAttributes]::ReparsePoint)) { $stack.Push($e) }
                }
                if (Test-Match $matchers $e.Name) {
                    [void]$results.Add($e)
                    if ($results.Count -ge $script:MaxResults) { $p.Stop = $true; break }
                }
            }
            if ($sw.ElapsedMilliseconds -gt 150) {
                $p.Status.Text = "검색 중... 폴더 $scanned 개 확인, 결과 $($results.Count) 개  (중지 가능)"
                [System.Windows.Forms.Application]::DoEvents()
                $sw.Restart()
            }
        }
    } finally {
        $p.SearchBtn.Enabled = $true
        $p.StopBtn.Enabled = $false
    }
    if ($p.SearchId -ne $myId) { return }   # 검색 도중 다른 폴더로 이동함
    $wasStopped = $p.Stop -and ($stack.Count -gt 0)
    $p.Stop = $false
    $p.Mode = 'search'; $p.Entries = $results
    $p.Address.Text = $p.Path
    Fill-List $p
    $note = ''
    if ($results.Count -ge $script:MaxResults) { $note = "(최대 $($script:MaxResults)개까지만 표시)" }
    elseif ($wasStopped) { $note = '(중간에 중지됨)' }
    if ($skipped -gt 0) { $note += " 접근 불가 폴더 $skipped 개 건너뜀" }
    Update-Status $p $note
}

# ---------------------------------------------------------------------
#  파일 작업 (Windows 기본 진행/덮어쓰기/휴지통 대화상자 사용)
# ---------------------------------------------------------------------
$UIAll  = [Microsoft.VisualBasic.FileIO.UIOption]::AllDialogs
$UICanc = [Microsoft.VisualBasic.FileIO.UICancelOption]::DoNothing
$VBFS   = [Microsoft.VisualBasic.FileIO.FileSystem]

function Transfer-Items([string[]]$sources, [string]$destDir, [bool]$move) {
    if (-not $destDir -or -not [System.IO.Directory]::Exists($destDir)) { Show-Error "대상 폴더가 없습니다: $destDir"; return }
    $destFull = [System.IO.Path]::GetFullPath($destDir).TrimEnd('\')
    foreach ($src in $sources) {
        try {
            $name = [System.IO.Path]::GetFileName($src.TrimEnd('\'))
            $dest = Join-Path $destFull $name
            $srcFull = [System.IO.Path]::GetFullPath($src).TrimEnd('\')
            if ($srcFull -eq $dest) { continue }                                   # 같은 위치
            if ($destFull.StartsWith($srcFull + '\', [StringComparison]::OrdinalIgnoreCase)) {
                Show-Error "폴더를 자기 자신의 하위 폴더로 옮기거나 복사할 수 없습니다.`n$srcFull"; continue
            }
            if ([System.IO.Directory]::Exists($src)) {
                if ($move) { $VBFS::MoveDirectory($src, $dest, $UIAll, $UICanc) } else { $VBFS::CopyDirectory($src, $dest, $UIAll, $UICanc) }
            } elseif ([System.IO.File]::Exists($src)) {
                if ($move) { $VBFS::MoveFile($src, $dest, $UIAll, $UICanc) } else { $VBFS::CopyFile($src, $dest, $UIAll, $UICanc) }
            }
        } catch [System.OperationCanceledException] {
            break
        } catch {
            Show-Error "작업 실패: $src`n`n$($_.Exception.Message)"
        }
    }
    Refresh-AllBrowsing
}

function Delete-Selected($p) {
    $sel = Get-SelectedEntries $p
    if ($sel.Count -eq 0) { return }
    if ($sel.Count -gt 1) {
        $r = [System.Windows.Forms.MessageBox]::Show("선택한 $($sel.Count)개 항목을 삭제할까요?`n(네트워크 드라이브는 휴지통 없이 바로 삭제될 수 있습니다)",
            'FourPane', [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Question)
        if ($r -ne [System.Windows.Forms.DialogResult]::Yes) { return }
    }
    $recycle = [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
    $ui = $UIAll
    if ($sel.Count -gt 1) { $ui = [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs }
    foreach ($e in $sel) {
        try {
            if ($e -is [System.IO.DirectoryInfo]) { $VBFS::DeleteDirectory($e.FullName, $ui, $recycle, $UICanc) }
            else { $VBFS::DeleteFile($e.FullName, $ui, $recycle, $UICanc) }
        } catch [System.OperationCanceledException] { break }
        catch { Show-Error "삭제 실패: $($e.FullName)`n`n$($_.Exception.Message)" }
    }
    Refresh-AllBrowsing
    if ($p.Mode -eq 'search') { Start-Search $p }
}

function New-FolderHere($p) {
    if ($p.Mode -ne 'browse') { return }
    $name = [Microsoft.VisualBasic.Interaction]::InputBox('새 폴더 이름을 입력하세요.', '새 폴더', '새 폴더')
    if (-not $name) { return }
    try { [void][System.IO.Directory]::CreateDirectory((Join-Path $p.Path $name)) }
    catch { Show-Error $_.Exception.Message }
    Refresh-AllBrowsing
}

function Copy-ToClipboard($p) {
    $sel = Get-SelectedEntries $p
    if ($sel.Count -eq 0) { return }
    $sc = New-Object System.Collections.Specialized.StringCollection
    foreach ($e in $sel) { [void]$sc.Add($e.FullName) }
    [System.Windows.Forms.Clipboard]::SetFileDropList($sc)
    Update-Status $p "($($sel.Count)개 복사됨 - 다른 칸에서 Ctrl+V)"
}

function Paste-FromClipboard($p) {
    if ($p.Mode -ne 'browse') { Update-Status $p '(검색 결과 화면에는 붙여넣을 수 없습니다)'; return }
    if (-not [System.Windows.Forms.Clipboard]::ContainsFileDropList()) { return }
    $files = @([System.Windows.Forms.Clipboard]::GetFileDropList())
    if ($files.Count -gt 0) { Transfer-Items $files $p.Path $false }
}

function Copy-PathText($p) {
    $sel = Get-SelectedEntries $p
    if ($sel.Count -gt 0) { $txt = ($sel | ForEach-Object { $_.FullName }) -join "`r`n" } else { $txt = $p.Path }
    if ($txt) { [System.Windows.Forms.Clipboard]::SetText($txt) }
}

# ---------------------------------------------------------------------
#  드라이브 목록 (네트워크 드라이브 포함)
#   1) 현재 세션에 연결된 드라이브 (DriveInfo)
#   2) 레지스트리에 저장된 '영구 연결' 네트워크 드라이브 (HKCU:\Network)
#      -> 현재 세션에서 드라이브 문자가 안 보이더라도 \\서버\공유 경로로 직접 열 수 있음
# ---------------------------------------------------------------------
function Get-MappedFromRegistry {
    $map = @{}
    try {
        if (Test-Path 'HKCU:\Network') {
            foreach ($k in Get-ChildItem 'HKCU:\Network') {
                $rp = (Get-ItemProperty -Path $k.PSPath -Name RemotePath -ErrorAction SilentlyContinue).RemotePath
                if ($rp) { $map[($k.PSChildName.ToUpper() + ':')] = $rp }
            }
        }
    } catch { }
    return $map
}

function Get-DriveMenuItems {
    $items = @()
    $reg = Get-MappedFromRegistry
    $seen = @{}
    foreach ($d in [System.IO.DriveInfo]::GetDrives()) {
        $letter = $d.Name.TrimEnd('\').ToUpper()
        $seen[$letter] = $true
        switch ($d.DriveType.ToString()) {
            'Fixed'     { $kind = '로컬 디스크' }
            'Network'   { $kind = '네트워크 드라이브' }
            'Removable' { $kind = '이동식 디스크' }
            'CDRom'     { $kind = 'CD/DVD' }
            default     { $kind = $d.DriveType.ToString() }
        }
        $label = "$letter   $kind"
        if ($d.DriveType.ToString() -eq 'Network') {
            # 네트워크 드라이브는 IsReady 확인이 오래 걸릴 수 있어 레지스트리 정보만 표시
            if ($reg.ContainsKey($letter)) { $label += "   ($($reg[$letter]))" }
        } elseif ($d.DriveType.ToString() -eq 'Fixed') {
            try { if ($d.IsReady -and $d.VolumeLabel) { $label += "   ($($d.VolumeLabel))" } } catch { }
        }
        $items += [pscustomobject]@{ Text = $label; Path = $d.Name }
    }
    foreach ($letter in ($reg.Keys | Sort-Object)) {
        if (-not $seen.ContainsKey($letter)) {
            $items += [pscustomobject]@{ Text = "$letter   네트워크 (이 창에선 문자 미연결 → $($reg[$letter]) 로 열기)"; Path = $reg[$letter] }
        }
    }
    return ,$items
}

function Get-SpecialFolders {
    return @(
        [pscustomobject]@{ Text = '바탕 화면'; Path = [Environment]::GetFolderPath('Desktop') },
        [pscustomobject]@{ Text = '문서';      Path = [Environment]::GetFolderPath('MyDocuments') },
        [pscustomobject]@{ Text = '다운로드';  Path = (Join-Path $env:USERPROFILE 'Downloads') },
        [pscustomobject]@{ Text = '사용자 폴더'; Path = $env:USERPROFILE }
    )
}

function Show-DriveMenu($p, $button) {
    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $menu.Font = $script:UiFont
    foreach ($d in (Get-DriveMenuItems)) {
        $mi = New-Object System.Windows.Forms.ToolStripMenuItem($d.Text)
        $mi.Tag = @{ Pane = $p; Path = $d.Path }
        $mi.Add_Click({ Navigate $this.Tag.Pane $this.Tag.Path })
        [void]$menu.Items.Add($mi)
    }
    [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    foreach ($s in (Get-SpecialFolders)) {
        $mi = New-Object System.Windows.Forms.ToolStripMenuItem($s.Text)
        $mi.Tag = @{ Pane = $p; Path = $s.Path }
        $mi.Add_Click({ Navigate $this.Tag.Pane $this.Tag.Path })
        [void]$menu.Items.Add($mi)
    }
    $menu.Show($button, 0, $button.Height)
}

function Show-FavMenu($p, $button) {
    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $menu.Font = $script:UiFont
    $add = New-Object System.Windows.Forms.ToolStripMenuItem('★ 현재 경로를 즐겨찾기에 추가')
    $add.Tag = $p
    $add.Add_Click({
        $q = $this.Tag
        if ($q.Path -and -not ($script:Favorites -contains $q.Path)) { [void]$script:Favorites.Add($q.Path); Save-Settings }
    })
    [void]$menu.Items.Add($add)
    if ($script:Favorites.Count -gt 0) {
        [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
        foreach ($f in $script:Favorites) {
            $mi = New-Object System.Windows.Forms.ToolStripMenuItem($f)
            $mi.Tag = @{ Pane = $p; Path = $f }
            $mi.Add_Click({ Navigate $this.Tag.Pane $this.Tag.Path })
            [void]$menu.Items.Add($mi)
        }
        [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
        $del = New-Object System.Windows.Forms.ToolStripMenuItem('즐겨찾기 삭제')
        foreach ($f in $script:Favorites) {
            $di = New-Object System.Windows.Forms.ToolStripMenuItem($f)
            $di.Tag = $f
            $di.Add_Click({ $script:Favorites.Remove($this.Tag); Save-Settings })
            [void]$del.DropDownItems.Add($di)
        }
        [void]$menu.Items.Add($del)
    }
    $menu.Show($button, 0, $button.Height)
}

# ---------------------------------------------------------------------
#  설정 저장 / 불러오기
# ---------------------------------------------------------------------
function Save-Settings {
    try {
        $obj = [ordered]@{
            Paths     = @($script:Panes | ForEach-Object { $_.Path })
            Favorites = @($script:Favorites)
            Recurse   = @($script:Panes | ForEach-Object { $_.Recurse.Checked })
        }
        if ($form.WindowState -eq [System.Windows.Forms.FormWindowState]::Normal) {
            $obj.Bounds = @($form.Left, $form.Top, $form.Width, $form.Height)
        } else {
            $b = $form.RestoreBounds
            $obj.Bounds = @($b.Left, $b.Top, $b.Width, $b.Height)
        }
        $obj.Maximized = ($form.WindowState -eq [System.Windows.Forms.FormWindowState]::Maximized)
        ($obj | ConvertTo-Json -Depth 4) | Set-Content -Path $script:Settings -Encoding UTF8
    } catch { Write-Log "설정 저장 실패: $($_.Exception.Message)" }
}

function Load-Settings {
    if (-not (Test-Path $script:Settings)) { return $null }
    try { return (Get-Content -Path $script:Settings -Raw -Encoding UTF8 | ConvertFrom-Json) }
    catch { Write-Log "설정 읽기 실패: $($_.Exception.Message)"; return $null }
}

# ---------------------------------------------------------------------
#  칸(Pane) 하나 만들기
# ---------------------------------------------------------------------
function New-Pane([int]$index) {
    $p = @{
        Index = $index; Path = ''; Mode = 'browse'; Entries = (New-Object System.Collections.ArrayList)
        History = (New-Object System.Collections.ArrayList); SortCol = 0; SortDesc = $false; Stop = $false; SearchId = 0
    }

    $root = New-Object System.Windows.Forms.TableLayoutPanel
    $root.Dock = 'Fill'; $root.ColumnCount = 1; $root.RowCount = 4; $root.Margin = 0; $root.Padding = 0
    [void]$root.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))
    [void]$root.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))
    [void]$root.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    [void]$root.RowStyles.Add((New-Object System.Windows.Forms.RowStyle([System.Windows.Forms.SizeType]::AutoSize)))

    # --- 1행: 이동 버튼 + 주소창 ---
    $nav = New-Object System.Windows.Forms.TableLayoutPanel
    $nav.Dock = 'Fill'; $nav.AutoSize = $true; $nav.RowCount = 1; $nav.ColumnCount = 7; $nav.Margin = 0
    for ($i = 0; $i -lt 6; $i++) { [void]$nav.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::AutoSize))) }
    [void]$nav.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))

    function New-Btn([string]$text, [string]$tip) {
        $b = New-Object System.Windows.Forms.Button
        $b.Text = $text; $b.AutoSize = $true; $b.AutoSizeMode = 'GrowAndShrink'
        $b.Margin = New-Object System.Windows.Forms.Padding(1); $b.Font = $script:UiFont
        $b.FlatStyle = 'System'
        $script:Tips.SetToolTip($b, $tip)
        return $b
    }

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = " $index "; $lbl.AutoSize = $true; $lbl.Anchor = 'Left'
    $lbl.Font = New-Object System.Drawing.Font('Malgun Gothic', 9, [System.Drawing.FontStyle]::Bold)
    $btnBack = New-Btn '←' '뒤로 (Alt+←)'
    $btnUp   = New-Btn '↑' '상위 폴더 (Backspace)'
    $btnRef  = New-Btn '새로고침' '새로고침 (F5)'
    $btnDrv  = New-Btn '드라이브 ▼' '드라이브 / 네트워크 드라이브 / 특수 폴더'
    $btnFav  = New-Btn '★ ▼' '즐겨찾기'
    $addr = New-Object System.Windows.Forms.TextBox
    $addr.Dock = 'Fill'; $addr.Font = $script:UiFont; $addr.Margin = New-Object System.Windows.Forms.Padding(2, 3, 2, 2)
    $script:Tips.SetToolTip($addr, '경로 입력 후 Enter (예: D:\자료, \\서버\공유, %USERPROFILE%)')
    $nav.Controls.Add($lbl, 0, 0); $nav.Controls.Add($btnBack, 1, 0); $nav.Controls.Add($btnUp, 2, 0)
    $nav.Controls.Add($btnRef, 3, 0); $nav.Controls.Add($btnDrv, 4, 0); $nav.Controls.Add($btnFav, 5, 0)
    $nav.Controls.Add($addr, 6, 0)

    # --- 2행: 검색 ---
    $sr = New-Object System.Windows.Forms.TableLayoutPanel
    $sr.Dock = 'Fill'; $sr.AutoSize = $true; $sr.RowCount = 1; $sr.ColumnCount = 5; $sr.Margin = 0
    [void]$sr.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::AutoSize)))
    [void]$sr.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::Percent, 100)))
    for ($i = 0; $i -lt 3; $i++) { [void]$sr.ColumnStyles.Add((New-Object System.Windows.Forms.ColumnStyle([System.Windows.Forms.SizeType]::AutoSize))) }
    $sl = New-Object System.Windows.Forms.Label
    $sl.Text = '검색'; $sl.AutoSize = $true; $sl.Anchor = 'Left'; $sl.Font = $script:UiFont
    $sbox = New-Object System.Windows.Forms.TextBox
    $sbox.Dock = 'Fill'; $sbox.Font = $script:UiFont; $sbox.Margin = New-Object System.Windows.Forms.Padding(2, 3, 2, 2)
    $script:Tips.SetToolTip($sbox, "이름 검색 (Enter). 띄어쓰기 = 모든 단어 포함. * ? 와일드카드 가능 (예: *.hwp). Esc = 검색 해제")
    $chk = New-Object System.Windows.Forms.CheckBox
    $chk.Text = '하위 폴더 포함'; $chk.AutoSize = $true; $chk.Checked = $true; $chk.Font = $script:UiFont; $chk.Anchor = 'Left'
    $btnS = New-Btn '검색' '검색 (Enter)'
    $btnX = New-Btn '중지' '검색 중지'
    $btnX.Enabled = $false
    $sr.Controls.Add($sl, 0, 0); $sr.Controls.Add($sbox, 1, 0); $sr.Controls.Add($chk, 2, 0)
    $sr.Controls.Add($btnS, 3, 0); $sr.Controls.Add($btnX, 4, 0)

    # --- 3행: 파일 목록 ---
    $list = New-Object System.Windows.Forms.ListView
    $list.Dock = 'Fill'; $list.View = 'Details'; $list.FullRowSelect = $true; $list.HideSelection = $false
    $list.AllowDrop = $true; $list.LabelEdit = $true; $list.Font = $script:UiFont
    $list.SmallImageList = $script:Images; $list.Margin = New-Object System.Windows.Forms.Padding(0)
    [void]$list.Columns.Add('이름', 260)
    [void]$list.Columns.Add('위치', 0)
    [void]$list.Columns.Add('크기', 80, [System.Windows.Forms.HorizontalAlignment]::Right)
    [void]$list.Columns.Add('종류', 90)
    [void]$list.Columns.Add('수정한 날짜', 120)
    $list.ContextMenuStrip = $script:ItemMenu

    # --- 4행: 상태 표시 ---
    $status = New-Object System.Windows.Forms.Label
    $status.Dock = 'Fill'; $status.AutoSize = $true; $status.Font = $script:UiFont
    $status.Padding = New-Object System.Windows.Forms.Padding(3, 2, 3, 2)

    $root.Controls.Add($nav, 0, 0); $root.Controls.Add($sr, 0, 1); $root.Controls.Add($list, 0, 2); $root.Controls.Add($status, 0, 3)

    $p.Root = $root; $p.Header = $nav; $p.List = $list; $p.Address = $addr; $p.SearchBox = $sbox
    $p.Recurse = $chk; $p.SearchBtn = $btnS; $p.StopBtn = $btnX; $p.Status = $status

    foreach ($c in @($btnBack, $btnUp, $btnRef, $btnDrv, $btnFav, $addr, $sbox, $btnS, $btnX, $list, $chk)) { $c.Tag = $p }

    # --- 이벤트 ---
    $btnBack.Add_Click({ Go-Back $this.Tag })
    $btnUp.Add_Click({ Go-Up $this.Tag })
    $btnRef.Add_Click({ Refresh-Pane $this.Tag })
    $btnDrv.Add_Click({ Show-DriveMenu $this.Tag $this })
    $btnFav.Add_Click({ Show-FavMenu $this.Tag $this })
    $btnS.Add_Click({ Start-Search $this.Tag })
    $btnX.Add_Click({ $this.Tag.Stop = $true })

    $addr.Add_KeyDown({ param($s, $e)
        if ($e.KeyCode -eq 'Enter') { $e.SuppressKeyPress = $true; Navigate $s.Tag $s.Text }
        elseif ($e.KeyCode -eq 'Escape') { $e.SuppressKeyPress = $true; $s.Text = $s.Tag.Path }
    })
    $sbox.Add_KeyDown({ param($s, $e)
        if ($e.KeyCode -eq 'Enter') { $e.SuppressKeyPress = $true; Start-Search $s.Tag }
        elseif ($e.KeyCode -eq 'Escape') {
            $e.SuppressKeyPress = $true; $s.Tag.Stop = $true; $s.Text = ''
            if ($s.Tag.Mode -eq 'search') { Navigate $s.Tag $s.Tag.Path $false }
        }
    })

    $list.Add_Enter({ Set-ActivePane $this.Tag })
    $list.Add_MouseDown({ Set-ActivePane $this.Tag })
    $list.Add_SelectedIndexChanged({ Update-Status $this.Tag })
    $list.Add_DoubleClick({
        $q = $this.Tag
        if ($q.List.SelectedItems.Count -gt 0) { Open-Entry $q $q.List.SelectedItems[0].Tag }
    })
    $list.Add_MouseUp({ param($s, $e)
        if ($e.Button -eq 'XButton1') { Go-Back $s.Tag }     # 마우스 뒤로 버튼
    })
    $list.Add_ColumnClick({ param($s, $e)
        $q = $s.Tag
        if ($q.SortCol -eq $e.Column) { $q.SortDesc = -not $q.SortDesc } else { $q.SortCol = $e.Column; $q.SortDesc = $false }
        Fill-List $q
    })
    $list.Add_KeyDown({ param($s, $e)
        $q = $s.Tag
        switch ($e.KeyCode) {
            'Enter'  { $e.SuppressKeyPress = $true; foreach ($x in (Get-SelectedEntries $q)) { Open-Entry $q $x; break } }
            'Back'   { $e.SuppressKeyPress = $true; Go-Up $q }
            'F5'     { Refresh-Pane $q }
            'Delete' { Delete-Selected $q }
            'F2'     { if ($q.List.FocusedItem) { $q.List.FocusedItem.BeginEdit() } }
            'Left'   { if ($e.Alt) { $e.SuppressKeyPress = $true; Go-Back $q } }
        }
        if ($e.Control) {
            switch ($e.KeyCode) {
                'C' { $e.SuppressKeyPress = $true; Copy-ToClipboard $q }
                'V' { $e.SuppressKeyPress = $true; Paste-FromClipboard $q }
                'A' { $e.SuppressKeyPress = $true; $q.List.BeginUpdate(); foreach ($it in $q.List.Items) { $it.Selected = $true }; $q.List.EndUpdate() }
                'F' { $e.SuppressKeyPress = $true; $q.SearchBox.Focus(); $q.SearchBox.SelectAll() }
                'L' { $e.SuppressKeyPress = $true; $q.Address.Focus(); $q.Address.SelectAll() }
            }
        }
    })

    # 이름 바꾸기 (F2)
    $list.Add_AfterLabelEdit({ param($s, $e)
        if ($null -eq $e.Label -or $e.Label.Trim() -eq '') { $e.CancelEdit = $true; return }
        $item = $s.Items[$e.Item]
        $old = $item.Tag
        $newName = $e.Label.Trim()
        if ($newName -eq $old.Name) { return }
        try {
            if ($old -is [System.IO.DirectoryInfo]) {
                $VBFS::RenameDirectory($old.FullName, $newName)
                $item.Tag = New-Object System.IO.DirectoryInfo((Join-Path (Get-ParentPath $old) $newName))
            } else {
                $VBFS::RenameFile($old.FullName, $newName)
                $item.Tag = New-Object System.IO.FileInfo((Join-Path $old.DirectoryName $newName))
            }
            $idx = $s.Tag.Entries.IndexOf($old)
            if ($idx -ge 0) { $s.Tag.Entries[$idx] = $item.Tag }
        } catch {
            $e.CancelEdit = $true
            Show-Error "이름을 바꿀 수 없습니다.`n`n$($_.Exception.Message)"
        }
    })

    # 끌어다 놓기: 칸 ↔ 칸, 칸 ↔ Windows 탐색기 (기본 복사, Shift = 이동)
    $list.Add_ItemDrag({ param($s, $e)
        $paths = @()
        foreach ($x in (Get-SelectedEntries $s.Tag)) { $paths += $x.FullName }
        if ($paths.Count -eq 0) { return }
        $data = New-Object System.Windows.Forms.DataObject([System.Windows.Forms.DataFormats]::FileDrop, [string[]]$paths)
        $r = $s.DoDragDrop($data, ([System.Windows.Forms.DragDropEffects]::Copy -bor [System.Windows.Forms.DragDropEffects]::Move))
        # Windows 탐색기로 '이동'한 경우 목록 새로고침 (칸끼리 이동은 타이머에서 처리)
        if ($r -eq [System.Windows.Forms.DragDropEffects]::Move -and -not $script:PendingDrop) { Refresh-AllBrowsing }
    })
    $dragOver = { param($s, $e)
        if (-not $e.Data.GetDataPresent([System.Windows.Forms.DataFormats]::FileDrop)) { $e.Effect = 'None'; return }
        $target = Get-DropTarget $s $e
        if (-not $target) { $e.Effect = 'None'; return }
        if (($e.KeyState -band 4) -eq 4) { $e.Effect = 'Move' } else { $e.Effect = 'Copy' }   # 4 = Shift
    }
    $list.Add_DragEnter($dragOver)
    $list.Add_DragOver($dragOver)
    $list.Add_DragDrop({ param($s, $e)
        $target = Get-DropTarget $s $e
        if (-not $target) { return }
        $files = [string[]]$e.Data.GetData([System.Windows.Forms.DataFormats]::FileDrop)
        $move = ($e.Effect -eq [System.Windows.Forms.DragDropEffects]::Move)
        # 놓은 뒤 작업 (대화상자가 드래그 중에 뜨지 않도록 잠시 뒤에 실행)
        $script:PendingDrop = @{ Files = $files; Target = $target; Move = $move }
        $script:DropTimer.Start()
    })

    return $p
}

# 드롭 위치 결정: 폴더 항목 위면 그 폴더, 빈 곳이면 현재 칸 경로 (검색 결과 화면은 폴더 위에서만)
function Get-DropTarget($list, $e) {
    $p = $list.Tag
    $pt = $list.PointToClient((New-Object System.Drawing.Point($e.X, $e.Y)))
    $hit = $list.GetItemAt($pt.X, $pt.Y)
    if ($hit -and ($hit.Tag -is [System.IO.DirectoryInfo])) { return $hit.Tag.FullName }
    if ($p.Mode -eq 'browse') { return $p.Path }
    return $null
}

function Set-ActivePane($p) {
    if ($script:ActivePane -eq $p) { return }
    $script:ActivePane = $p
    foreach ($q in $script:Panes) {
        if ($q -eq $p) { $q.Header.BackColor = [System.Drawing.Color]::FromArgb(204, 228, 247) }
        else { $q.Header.BackColor = [System.Drawing.SystemColors]::Control }
    }
}

# ---------------------------------------------------------------------
#  오른쪽 클릭 메뉴 (네 칸 공용)
# ---------------------------------------------------------------------
function Add-MenuItem($menu, [string]$text, [scriptblock]$action, [string]$keys = '') {
    $mi = New-Object System.Windows.Forms.ToolStripMenuItem($text)
    if ($keys) { $mi.ShortcutKeyDisplayString = $keys }
    $mi.Add_Click($action)
    [void]$menu.Items.Add($mi)
    return $mi
}

$script:Tips = New-Object System.Windows.Forms.ToolTip
$script:ItemMenu = New-Object System.Windows.Forms.ContextMenuStrip
$script:ItemMenu.Font = $script:UiFont
[void](Add-MenuItem $script:ItemMenu '열기' {
    $q = $script:ActivePane; foreach ($x in (Get-SelectedEntries $q)) { Open-Entry $q $x; break } } 'Enter')
$script:MiGoParent = Add-MenuItem $script:ItemMenu '이 항목이 있는 폴더로 이동' {
    $q = $script:ActivePane; $sel = Get-SelectedEntries $q
    if ($sel.Count -gt 0) { Navigate $q (Get-ParentPath $sel[0]) } }
[void](Add-MenuItem $script:ItemMenu 'Windows 탐색기에서 보기' {
    $q = $script:ActivePane; $sel = Get-SelectedEntries $q
    if ($sel.Count -gt 0) { Start-Process explorer.exe -ArgumentList "/select,`"$($sel[0].FullName)`"" }
    elseif ($q.Path) { Start-Process explorer.exe -ArgumentList "`"$($q.Path)`"" } })
[void]$script:ItemMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void](Add-MenuItem $script:ItemMenu '복사' { Copy-ToClipboard $script:ActivePane } 'Ctrl+C')
[void](Add-MenuItem $script:ItemMenu '붙여넣기' { Paste-FromClipboard $script:ActivePane } 'Ctrl+V')
[void](Add-MenuItem $script:ItemMenu '경로 복사 (텍스트)' { Copy-PathText $script:ActivePane })
[void]$script:ItemMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
[void](Add-MenuItem $script:ItemMenu '새 폴더' { New-FolderHere $script:ActivePane })
[void](Add-MenuItem $script:ItemMenu '이름 바꾸기' {
    $q = $script:ActivePane; if ($q.List.SelectedItems.Count -gt 0) { $q.List.SelectedItems[0].BeginEdit() } } 'F2')
[void](Add-MenuItem $script:ItemMenu '삭제' { Delete-Selected $script:ActivePane } 'Del')
$script:ItemMenu.Add_Opening({
    $q = $script:ActivePane
    $script:MiGoParent.Visible = ($null -ne $q -and $q.Mode -eq 'search')
})

# ---------------------------------------------------------------------
#  메인 창
# ---------------------------------------------------------------------
$form = New-Object System.Windows.Forms.Form
$form.Text = 'FourPane - 4분할 탐색기'
$form.Size = New-Object System.Drawing.Size(1400, 900)
$form.StartPosition = 'CenterScreen'
$form.Font = $script:UiFont
$form.KeyPreview = $true

# 드롭 후 작업 실행용 타이머
$script:PendingDrop = $null
$script:DropTimer = New-Object System.Windows.Forms.Timer
$script:DropTimer.Interval = 50
$script:DropTimer.Add_Tick({
    $script:DropTimer.Stop()
    $d = $script:PendingDrop; $script:PendingDrop = $null
    if ($d) { Transfer-Items $d.Files $d.Target $d.Move }
})

$outer = New-Object System.Windows.Forms.SplitContainer
$outer.Dock = 'Fill'; $outer.Orientation = 'Horizontal'; $outer.SplitterWidth = 6
$top = New-Object System.Windows.Forms.SplitContainer
$top.Dock = 'Fill'; $top.Orientation = 'Vertical'; $top.SplitterWidth = 6
$bottom = New-Object System.Windows.Forms.SplitContainer
$bottom.Dock = 'Fill'; $bottom.Orientation = 'Vertical'; $bottom.SplitterWidth = 6
$outer.Panel1.Controls.Add($top)
$outer.Panel2.Controls.Add($bottom)
$form.Controls.Add($outer)

$script:Panes = @((New-Pane 1), (New-Pane 2), (New-Pane 3), (New-Pane 4))
$top.Panel1.Controls.Add($script:Panes[0].Root)
$top.Panel2.Controls.Add($script:Panes[1].Root)
$bottom.Panel1.Controls.Add($script:Panes[2].Root)
$bottom.Panel2.Controls.Add($script:Panes[3].Root)

function Set-EvenSplit {
    try {
        $outer.SplitterDistance  = [int](($outer.Height - $outer.SplitterWidth) / 2)
        $top.SplitterDistance    = [int](($top.Width - $top.SplitterWidth) / 2)
        $bottom.SplitterDistance = [int](($bottom.Width - $bottom.SplitterWidth) / 2)
    } catch { }
}

# 단축키: Ctrl+1~4 = 해당 칸으로 이동, Ctrl+0 = 네 칸 크기 똑같이
$form.Add_KeyDown({ param($s, $e)
    if ($e.Control) {
        $n = -1
        switch ($e.KeyCode) { 'D1' { $n = 0 } 'D2' { $n = 1 } 'D3' { $n = 2 } 'D4' { $n = 3 } 'D0' { Set-EvenSplit; $e.SuppressKeyPress = $true } }
        if ($n -ge 0) { $e.SuppressKeyPress = $true; $script:Panes[$n].List.Focus() }
    }
})

# 시작 시 설정 불러오기
$cfg = Load-Settings
if ($cfg) {
    foreach ($f in @($cfg.Favorites)) { if ($f) { [void]$script:Favorites.Add([string]$f) } }
    if ($cfg.Bounds -and @($cfg.Bounds).Count -eq 4) {
        $b = @($cfg.Bounds)
        $form.StartPosition = 'Manual'
        $form.Bounds = New-Object System.Drawing.Rectangle([int]$b[0], [int]$b[1], [int]$b[2], [int]$b[3])
        # 화면 밖으로 나가 있으면 가운데로
        $visible = $false
        foreach ($scr in [System.Windows.Forms.Screen]::AllScreens) { if ($scr.WorkingArea.IntersectsWith($form.Bounds)) { $visible = $true } }
        if (-not $visible) { $form.StartPosition = 'CenterScreen' }
    }
    if ($cfg.Maximized) { $form.WindowState = 'Maximized' }
}

$form.Add_Shown({
    Set-EvenSplit
    $paths = @()
    if ($cfg -and $cfg.Paths) { $paths = @($cfg.Paths) }
    $defaults = @($env:USERPROFILE, [Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('MyDocuments'), (Join-Path $env:USERPROFILE 'Downloads'))
    for ($i = 0; $i -lt 4; $i++) {
        $p = $script:Panes[$i]
        if ($cfg -and $cfg.Recurse -and @($cfg.Recurse).Count -gt $i) { $p.Recurse.Checked = [bool]@($cfg.Recurse)[$i] }
        $want = $null
        if ($paths.Count -gt $i -and $paths[$i]) { $want = [string]$paths[$i] }
        if ($want -and [System.IO.Directory]::Exists($want)) { Navigate $p $want $false }
        else {
            $d = $defaults[$i]
            if (-not [System.IO.Directory]::Exists($d)) { $d = $env:USERPROFILE }
            Navigate $p $d $false
            if ($want) { Update-Status $p "(지난번 경로를 열 수 없어 기본 폴더로 시작: $want)" }
        }
    }
    $script:Panes[0].List.Focus()
})

$form.Add_FormClosing({
    foreach ($p in $script:Panes) { $p.Stop = $true; $p.SearchId++ }
    Save-Settings
})

try {
    [void]$form.ShowDialog()
} catch {
    Show-Error "예기치 않은 오류: $($_.Exception.Message)`n$($_.ScriptStackTrace)"
}
