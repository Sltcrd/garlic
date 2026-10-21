// pdf.js ships as ES modules: load it here and expose it as window.pdfjsLib for the classic scripts.
import * as pdfjs from '../../../node_modules/pdfjs-dist/build/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;
window.pdfjsLib = pdfjs;
if (window.__pdfResolve) window.__pdfResolve(pdfjs);
