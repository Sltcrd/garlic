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
# one compilation instead of three: compiling is the slow part of the first start
Add-Type -TypeDefinition @'
using System;using System.Text;using System.Runtime.InteropServices;
public class DPI{[DllImport("user32.dll")]public static extern bool SetProcessDPIAware();}
public class WinAt{[DllImport("user32.dll")]static extern IntPtr WindowFromPoint(long p);[DllImport("user32.dll")]static extern IntPtr GetAncestor(IntPtr h,uint f);[DllImport("user32.dll")]static extern int GetClassName(IntPtr h,StringBuilder s,int n);public static string RootClass(int x,int y){IntPtr h=WindowFromPoint(((long)y<<32)|(uint)x);if(h==IntPtr.Zero)return "";IntPtr r=GetAncestor(h,2);var sb=new StringBuilder(64);GetClassName(r==IntPtr.Zero?h:r,sb,64);return sb.ToString();}}
public class LvHit{
 [DllImport("user32.dll")]static extern IntPtr WindowFromPoint(long p);
 [DllImport("user32.dll")]static extern int GetClassName(IntPtr h,StringBuilder s,int n);
 [DllImport("user32.dll")]static extern bool ScreenToClient(IntPtr h,ref PT p);
 [DllImport("user32.dll")]static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
 [DllImport("user32.dll")]static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,IntPtr l);
 [DllImport("kernel32.dll")]static extern IntPtr OpenProcess(uint a,bool i,uint pid);
 [DllImport("kernel32.dll")]static extern IntPtr VirtualAllocEx(IntPtr p,IntPtr a,UIntPtr s,uint t,uint pr);
 [DllImport("kernel32.dll")]static extern bool VirtualFreeEx(IntPtr p,IntPtr a,UIntPtr s,uint t);
 [DllImport("kernel32.dll")]static extern bool WriteProcessMemory(IntPtr p,IntPtr a,byte[] b,int n,out IntPtr w);
 [DllImport("kernel32.dll")]static extern bool ReadProcessMemory(IntPtr p,IntPtr a,byte[] b,int n,out IntPtr r);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr h);
 struct PT{public int x,y;}
 public static string NameAt(int x,int y){
  IntPtr lv=WindowFromPoint(((long)y<<32)|(uint)x); if(lv==IntPtr.Zero)return "";
  var sb=new StringBuilder(64);GetClassName(lv,sb,64); if(sb.ToString()!="SysListView32")return "";
  var pt=new PT{x=x,y=y}; ScreenToClient(lv,ref pt);
  uint pid;GetWindowThreadProcessId(lv,out pid);
  IntPtr hp=OpenProcess(0x0038,false,pid); if(hp==IntPtr.Zero)return "";
  IntPtr mem=VirtualAllocEx(hp,IntPtr.Zero,(UIntPtr)4096,0x3000,4); if(mem==IntPtr.Zero){CloseHandle(hp);return "";}
  try{
   IntPtr n;
   var hit=new byte[24]; BitConverter.GetBytes(pt.x).CopyTo(hit,0); BitConverter.GetBytes(pt.y).CopyTo(hit,4);
   WriteProcessMemory(hp,mem,hit,24,out n);
   int idx=(int)(long)SendMessage(lv,0x1012,IntPtr.Zero,mem);                  // LVM_HITTEST
   var back=new byte[24]; ReadProcessMemory(hp,mem,back,24,out n);
   uint flags=BitConverter.ToUInt32(back,8);
   if(idx<0||(flags&0xE)==0)return "";
   var it=new byte[88]; BitConverter.GetBytes(1).CopyTo(it,0); BitConverter.GetBytes(idx).CopyTo(it,4);
   BitConverter.GetBytes((long)(mem+512)).CopyTo(it,24); BitConverter.GetBytes(260).CopyTo(it,32);
   WriteProcessMemory(hp,mem+256,it,88,out n);
   SendMessage(lv,0x1073,(IntPtr)idx,mem+256);                                    // LVM_GETITEMTEXTW
   var txt=new byte[520]; ReadProcessMemory(hp,mem+512,txt,520,out n);
   string s=Encoding.Unicode.GetString(txt); int z=s.IndexOf('\0'); return z>=0?s.Substring(0,z):s;
  }finally{VirtualFreeEx(hp,mem,UIntPtr.Zero,0x8000);CloseHandle(hp);}
 }
}
'@
[DPI]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName UIAutomationClient,UIAutomationTypes,WindowsBase
$sh = New-Object -ComObject Shell.Application
[Console]::Out.WriteLine('READY')
while($true){
  $l=[Console]::In.ReadLine(); if($l -eq $null){break}
  $res=''
  try{
    $p=$l.Split(' '); $x=[int]$p[0]; $y=[int]$p[1]
    $cls=''; try{ $cls=[WinAt]::RootClass($x,$y) }catch{}
    $desk=($cls -eq 'Progman' -or $cls -eq 'WorkerW')
    $name=$null
    if($desk){ $name=[LvHit]::NameAt($x,$y); if(-not $name){ $name=$null } }
    Start-Sleep -Milliseconds 120
    $e=[System.Windows.Automation.AutomationElement]::FromPoint((New-Object System.Windows.Point($x,$y)))
    $w=[System.Windows.Automation.TreeWalker]::ControlViewWalker
    for($i=0;$i -lt 5 -and $e -ne $null -and -not $desk;$i++){
      $t=$e.Current.ControlType.ProgrammaticName
      if($t -eq 'ControlType.ListItem' -or $t -eq 'ControlType.DataItem'){ $name=$e.Current.Name; break }
      $e=$w.GetParent($e)
    }
    for($try=0;$try -lt 5 -and -not $res -and -not $desk;$try++){
      if($try -gt 0){ Start-Sleep -Milliseconds 150 }
      $found=@()
      foreach($win in $sh.Windows()){
        try{ foreach($it in $win.Document.SelectedItems()){ $found += ,@($it.Name,$it.Path) } }catch{}
      }
      if($name){ foreach($f in $found){ if($f[0] -eq $name -or [IO.Path]::GetFileName($f[1]) -eq $name){ $res=$f[1]; break } } }
      if(-not $res -and $try -eq 4 -and -not $name -and $found.Count -eq 1){ $res=$found[0][1] }
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
const isReady = () => ready;
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

module.exports = { name: 'win32', supported: true, start, stop, resolve, isReady };
