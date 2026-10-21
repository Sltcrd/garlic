'use strict';
/**
 * The only bridge between the web pages and the main process. Renderers have no Node.js access;
 * they can only call these functions, and the main process validates every argument.
 */
const { contextBridge, ipcRenderer, webUtils } = require('electron');

const send = ch => a => ipcRenderer.send(ch, a);
const invoke = ch => a => ipcRenderer.invoke(ch, a);
const on = ch => cb => ipcRenderer.on(ch, (_e, data) => cb(data));

contextBridge.exposeInMainWorld('native', {
  /* files */
  pathOf: f => { try { return webUtils.getPathForFile(f); } catch { return ''; } },
  readFile: invoke('file:read'), save: invoke('save'), reveal: send('reveal'), fileAction: invoke('file:action'),
  pick: () => ipcRenderer.invoke('app:pick'), openWheel: send('app:open-wheel'),
  /* settings */
  cfgDefaults: () => ipcRenderer.invoke('cfg:defaults'), cfgGet: () => ipcRenderer.invoke('cfg:get'), cfgSet: invoke('cfg:set'), onCfg: on('cfg:update'),
  appInfo: () => ipcRenderer.invoke('app:info'), createShortcut: w => ipcRenderer.invoke('shortcut:create', w), hookStatus: () => ipcRenderer.invoke('hook:status'), quit: () => ipcRenderer.send('app:quit'),
  /* windows */
  winCtl: send('win:ctl'), onWinState: on('win:state'),
  onWheelOpen: on('wheel:open'), wheelHide: () => ipcRenderer.send('wheel:hide'), wheelPing: () => ipcRenderer.send('wheel:ping'),
  openEditor: send('editor:open'), onEditorOpen: on('editor:open'),
  notify: send('notify'),
  /* conversion helpers that need the main process */
  ffProbe: invoke('ff:probe'), ffRun: invoke('ff:run'), packDir: invoke('dir:pack'), htmlPdf: invoke('html:pdf'), htmlInline: invoke('html:inline'),
  /* jobs / progress cards */
  jobStart: invoke('job:start'), jobProgress: send('job:progress'), jobDone: send('job:done'), jobError: send('job:error'), jobQuick: send('job:quick'),
  jobAction: send('job:action'), jobsSize: send('jobs:size'), jobsHover: send('jobs:hover'), onJobs: on('jobs:state'),
  /* automated tests only (the handler exists when GARLIC_TEST=1) */
  testState: () => ipcRenderer.invoke('test:state'), testJobs: () => ipcRenderer.invoke('test:jobs')
});
