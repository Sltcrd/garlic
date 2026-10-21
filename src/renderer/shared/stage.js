/* The "stage": state of the file currently being worked on (wheel and editor), plus loading and saving helpers. */
const $ = s => document.querySelector(s);
const ST = { file: null, path: '', dir: '', name: '', ext: '', kind: null, pdf: null, pages: 0, img: null, thumb: null, mode: 'convert', page: 0, ready: Promise.resolve() };

const dirname = p => p.replace(/[\\/][^\\/]*$/, '');
const basename = p => p.split(/[\\/]/).pop();

let toastTimer;
function toast(msg, err = false) {
  const el = $('#toast'); if (!el) return;
  el.className = err ? 'er' : ''; el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5000);
}

/** Resets the stage for a new path (before the file itself is decoded). */
function resetStage(path, isDir) {
  const name = basename(path), ext = normExt((name.split('.').pop() || '').toLowerCase());
  Object.assign(ST, {
    file: null, img: null, pdf: null, thumb: null, pages: 0, path, dir: dirname(path), name: name.replace(/\.[^.]+$/, ''),
    ext: name.includes('.') && !isDir ? ext : '', kind: isDir ? 'folder' : kindOfExt(ext), page: 0
  });
}

/** Decodes images and PDFs (needed to convert and edit them). Other kinds are read on demand. */
async function openFile(f, p) {
  const ext = normExt((f.name.split('.').pop() || '').toLowerCase()), kind = kindOfExt(ext);
  Object.assign(ST, { file: f, path: p, dir: dirname(p), name: f.name.replace(/\.[^.]+$/, ''), ext, kind, pdf: null, pages: 0, img: null });
  if (kind === 'pdf') { ST.pdf = await loadPdf(new Uint8Array(await f.arrayBuffer())); ST.pages = ST.pdf.numPages; ST.img = await renderPdfPage(ST.pdf, 1); }
  else if (kind === 'image') {
    if (ext === 'heic' || ext === 'heif') { let b = await heic2any({ blob: f, toType: 'image/png' }); if (Array.isArray(b)) b = b[0]; ST.img = await blobToCanvas(b); }
    else if (ext === 'tiff') ST.img = tiffToCanvas(await f.arrayBuffer());
    else ST.img = await blobToCanvas(f);
  }
}
async function loadFromDisk(path) {
  const bytes = await nat.readFile(path);
  return openFile(new File([bytes], basename(path)), path);
}

/** Saves a single result next to the original and shows it in the "done" card (used by the editor tools). */
async function saveBlob(blob, suffix, ext) {
  const p = await nat.save({ dir: ST.dir, base: ST.name + suffix, ext: '.' + ext, bytes: new Uint8Array(await blob.arrayBuffer()) });
  Snd.play('ok'); nat.jobQuick({ title: t('Guardado'), name: basename(p), out: p });
  return p;
}
