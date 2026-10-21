'use strict';
/**
 * Windows: find the file under the mouse in File Explorer / the Desktop.
 * A long-lived PowerShell process uses UI Automation (to read the name of the clicked list item) and the
 * Shell.Application COM object (to read the full path of the selected items). It is fed screen coordinates
 * on stdin and answers with one line per request. The script is passed with -EncodedCommand; the only
 * data interpolated into it are two integers, so there is no injection surface.
 */
const { spawn } = require('child_process');

const SCRIPT = String.raw`
$ErrorActionPreference='SilentlyContinue'
[Console]::OutputEncoding=[Text.Encoding]::UTF8
Add-Type -TypeDefinition 'using System.Runtime.InteropServices;public class DPI{[DllImport("user32.dll")]public static extern bool SetProcessDPIAware();}'
[DPI]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
$sh = New-Object -ComObject Shell.Application
[Console]::Out.WriteLine('READY')
while($true){
  $l=[Console]::In.ReadLine(); if($l -eq $null){break}
  $res=''
  try{
    $p=$l.Split(' '); $x=[int]$p[0]; $y=[int]$p[1]
    Start-Sleep -Milliseconds 120
    $e=[System.Windows.Automation.AutomationElement]::FromPoint((New-Object System.Windows.Point($x,$y)))
    $w=[System.Windows.Automation.TreeWalker]::ControlViewWalker
    $name=$null
    for($i=0;$i -lt 5 -and $e -ne $null;$i++){
      $t=$e.Current.ControlType.ProgrammaticName
      if($t -eq 'ControlType.ListItem' -or $t -eq 'ControlType.DataItem'){ $name=$e.Current.Name; break }
      $e=$w.GetParent($e)
    }
    for($try=0;$try -lt 5 -and -not $res;$try++){
      if($try -gt 0){ Start-Sleep -Milliseconds 150 }
      $found=@()
      foreach($win in $sh.Windows()){
        try{ foreach($it in $win.Document.SelectedItems()){ $found += ,@($it.Name,$it.Path) } }catch{}
      }
      if($name){ foreach($f in $found){ if($f[0] -eq $name -or [IO.Path]::GetFileName($f[1]) -eq $name){ $res=$f[1]; break } } }
      if(-not $res -and $try -eq 4 -and $found.Count -eq 1){ $res=$found[0][1] }
    }
    if(-not $res -and $name){
      foreach($d in @([Environment]::GetFolderPath('Desktop'),[Environment]::GetFolderPath('CommonDesktopDirectory'))){
        if($d -and (Test-Path -LiteralPath $d)){ foreach($f in Get-ChildItem -LiteralPath $d -Force){ if($f.Name -eq $name -or $f.BaseName -eq $name){ $res=$f.FullName; break } } }
        if($res){ break }
      }
    }
  }catch{}
  [Console]::Out.WriteLine('RES|'+$res)
}`;

let ps = null, ready = false, buf = '', waiting = null;

function start() {
  if (ps) return;
  ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(SCRIPT, 'utf16le').toString('base64')], { windowsHide: true });
  ps.stdout.setEncoding('utf8');
  ps.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line === 'READY') ready = true;
      else if (line.startsWith('RES|') && waiting) { const r = waiting; waiting = null; r(line.slice(4)); }
    }
  });
  ps.on('error', () => { ps = null; ready = false; });
  ps.on('exit', () => { ready = false; ps = null; if (waiting) { waiting(''); waiting = null; } });
}
function stop() { try { if (ps) ps.kill(); } catch { /* already gone */ } ps = null; ready = false; }

/** @param {{x:number,y:number}} pt screen coordinates in physical pixels */
function resolve(pt) {
  return new Promise(res => {
    start();
    const x = Math.trunc(pt.x), y = Math.trunc(pt.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !ready || waiting) return res('');
    waiting = res; ps.stdin.write(`${x} ${y}\n`);
    setTimeout(() => { if (waiting === res) { waiting = null; res(''); } }, 4000);
  });
}

module.exports = { name: 'win32', supported: true, start, stop, resolve };
