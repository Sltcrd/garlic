/* Editor window: loads the file chosen in the wheel and opens the requested tool. */
$('#bmin').onclick = () => nat.winCtl('min');
$('#bmax').onclick = () => nat.winCtl('max');
$('#bclose').onclick = () => nat.winCtl('close');
nat.onWinState(max => { $('#icMax').hidden = max; $('#icRes').hidden = !max; $('#bmax').title = max ? t('Restaurar') : t('Maximizar'); });

nat.onEditorOpen(async ({ path, tool }) => {
  resetStage(path, false);
  try {
    if (ST.kind === 'image' || ST.kind === 'pdf') await loadFromDisk(path);
    openPanel(tool);
  } catch (e) { toast(e.message, true); }
});
document.addEventListener('lang', () => { if (P) { $('#ptitle').textContent = P.title; } });
cfgInit();
