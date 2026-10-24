import { PDFDocument, rgb } from 'pdf-lib';
import './style.css';

const $ = (id) => document.getElementById(id);
const fileInput = $('fileInput');
const dropzone = $('dropzone');
const processButton = $('processButton');
const clearButton = $('clearButton');
const fileList = $('fileList');
const status = $('status');
const previewEmpty = $('previewEmpty');
const previewWrap = $('previewWrap');
const pdfPreview = $('pdfPreview');
const previewName = $('previewName');
const downloadButton = $('downloadButton');
const printButton = $('printButton');
const savedList = $('savedList');
const clearAllSavedButton = $('clearAllSaved');

let selectedFiles = [];
let latestOutput = null;
let latestObjectUrl = null;
let activePreviewId = null;
const dbPromise = openDatabase();

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('center-dot-printer', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('outputs')) {
        const store = db.createObjectStore('outputs', { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeOutput(record) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outputs', 'readwrite');
    tx.objectStore('outputs').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getOutputs() {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outputs', 'readonly');
    const request = tx.objectStore('outputs').getAll();
    request.onsuccess = () => resolve(request.result.sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}

async function deleteOutput(id) {
  const db = await dbPromise;
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outputs', 'readwrite');
    tx.objectStore('outputs').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function fileType(file) {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'jpg';
  if (file.type === 'image/png' || name.endsWith('.png')) return 'png';
  if (name.endsWith('.docx')) return 'docx';
  return 'unknown';
}

function prettyBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function setStatus(message, kind = '') {
  status.textContent = message;
  status.className = `status ${kind}`.trim();
}

function renderSelectedFiles() {
  clearButton.disabled = selectedFiles.length === 0;
  processButton.disabled = $('jobMode').value === 'files' && selectedFiles.length === 0;
  if (!selectedFiles.length) {
    fileList.innerHTML = `<div class="empty-state"><div class="empty-icon">▤</div><strong>No files selected</strong><span>Your selected files and generated PDFs will appear here.</span></div>`;
    return;
  }
  fileList.innerHTML = selectedFiles.map((file, index) => {
    const type = fileType(file);
    const typeLabel = type === 'docx' ? 'DOCX · needs local conversion' : type.toUpperCase();
    const icon = type === 'pdf' ? 'PDF' : type === 'docx' ? 'DOC' : 'IMG';
    return `<div class="file-row">
      <div class="file-badge ${type}">${icon}</div>
      <div class="file-info"><strong title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</strong><span>${prettyBytes(file.size)} · ${typeLabel}</span></div>
      <button class="icon-button remove-file" data-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">×</button>
    </div>`;
  }).join('');
  fileList.querySelectorAll('.remove-file').forEach(button => {
    button.addEventListener('click', () => {
      selectedFiles.splice(Number(button.dataset.index), 1);
      renderSelectedFiles();
    });
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function addFiles(fileListLike) {
  const incoming = Array.from(fileListLike);
  const supported = incoming.filter(file => fileType(file) !== 'unknown');
  const unsupported = incoming.filter(file => fileType(file) === 'unknown');
  const existingKeys = new Set(selectedFiles.map(file => `${file.name}:${file.size}:${file.lastModified}`));
  for (const file of supported) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (!existingKeys.has(key)) selectedFiles.push(file);
  }
  renderSelectedFiles();
  if (unsupported.length) setStatus(`${unsupported.length} unsupported file(s) skipped. Add PDF, JPG, PNG, or DOCX.`, 'warning');
  else if (supported.some(file => fileType(file) === 'docx')) setStatus('DOCX files are listed, but must first be converted locally to PDF in this version.', 'warning');
  else if (supported.length) setStatus(`${supported.length} file(s) added. Select “Add center dots” when ready.`);
}

fileInput.addEventListener('change', (event) => {
  addFiles(event.target.files);
  fileInput.value = '';
});
dropzone.addEventListener('dragover', event => {
  event.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', event => {
  event.preventDefault();
  dropzone.classList.remove('dragover');
  addFiles(event.dataTransfer.files);
});
clearButton.addEventListener('click', () => {
  selectedFiles = [];
  renderSelectedFiles();
  setStatus('File selection cleared.');
});

function addCenterDot(page, diameterMm) {
  const { width, height } = page.getSize();
  const diameterPoints = diameterMm / 25.4 * 72;
  page.drawCircle({
    // Keep the entire circle inside the page while touching the left edge.
    // The circle centre is one radius from the edge, vertically centred.
    x: diameterPoints / 2,
    y: height / 2,
    size: diameterPoints / 2,
    color: rgb(0, 0, 0),
    borderColor: rgb(0, 0, 0),
    borderWidth: 0
  });
}

async function processPdf(file, dotMm) {
  const source = new Uint8Array(await file.arrayBuffer());
  const pdf = await PDFDocument.load(source, { updateMetadata: false });
  for (const page of pdf.getPages()) addCenterDot(page, dotMm);
  return await pdf.save();
}

async function processImage(file, dotMm, dpi) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdf = await PDFDocument.create();
  const pointsPerPixel = 72 / dpi;
  let image;
  if (fileType(file) === 'jpg') image = await pdf.embedJpg(bytes);
  else image = await pdf.embedPng(bytes);
  const width = image.width * pointsPerPixel;
  const height = image.height * pointsPerPixel;
  const page = pdf.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  addCenterDot(page, dotMm);
  return await pdf.save();
}

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function mmToPoints(mm) { return mm / 25.4 * 72; }

function selectedPaperDimensionsMm() {
  const presets = {
    A4: [210, 297],
    A3: [297, 420],
    A5: [148, 210],
    Legal: [215.9, 355.6],
    Letter: [215.9, 279.4]
  };
  const paper = $('paperSize').value;
  let [width, height] = paper === 'Custom'
    ? [Number($('customWidth').value), Number($('customHeight').value)]
    : presets[paper];
  if ($('orientation').value === 'landscape' && height > width) [width, height] = [height, width];
  if ($('orientation').value === 'portrait' && width > height) [width, height] = [height, width];
  return [width, height];
}

async function processBlankPages(dotMm) {
  const [widthMm, heightMm] = selectedPaperDimensionsMm();
  const count = Number($('blankPages').value);
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm < 10 || heightMm < 10 || widthMm > 2000 || heightMm > 2000) {
    throw new Error('Custom page dimensions must be between 10 and 2000 mm.');
  }
  if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('Page count must be between 1 and 500.');
  const pdf = await PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage([mmToPoints(widthMm), mmToPoints(heightMm)]);
    addCenterDot(page, dotMm);
  }
  const bytes = await pdf.save();
  const record = {
    id: uuid(),
    name: `blank-center-dot-${widthMm}x${heightMm}mm-${count}pages.pdf`,
    sourceName: 'Blank page generator',
    bytes,
    size: bytes.byteLength,
    createdAt: Date.now(),
    dotMm,
    dpi: null
  };
  await storeOutput(record);
  showPreview(record);
  await renderSavedOutputs();
  setStatus(`Created ${count} blank page(s) with a left-edge center dot.`, 'success');
}

async function processSelectedFiles() {
  const dotMm = Number($('dotSize').value);
  const dpi = Number($('imageDpi').value);
  if (!Number.isFinite(dotMm) || dotMm < 1 || dotMm > 10) {
    setStatus('Dot diameter must be between 1 and 10 mm.', 'error');
    return;
  }
  if (!Number.isFinite(dpi) || dpi < 72 || dpi > 1200) {
    setStatus('Image DPI must be between 72 and 1200.', 'error');
    return;
  }
  if ($('jobMode').value === 'blank') {
    processButton.disabled = true;
    processButton.innerHTML = '<span class="spinner"></span> Creating…';
    try {
      await processBlankPages(dotMm);
    } catch (error) {
      setStatus(error?.message || 'Could not create blank PDF.', 'error');
    } finally {
      processButton.disabled = false;
      processButton.innerHTML = '<span>＋</span> Create PDF with center dots';
    }
    return;
  }
  const work = selectedFiles.filter(file => fileType(file) !== 'docx');
  const docxCount = selectedFiles.filter(file => fileType(file) === 'docx').length;
  if (!work.length) {
    setStatus('Convert DOCX files to PDF locally with LibreOffice, then select the PDFs here. No Word file has been uploaded.', 'warning');
    return;
  }

  processButton.disabled = true;
  processButton.innerHTML = '<span class="spinner"></span> Processing…';
  let completed = 0;
  let failures = [];
  for (const file of work) {
    setStatus(`Processing ${completed + 1} of ${work.length}: ${file.name}`);
    try {
      const type = fileType(file);
      const bytes = type === 'pdf'
        ? await processPdf(file, dotMm)
        : await processImage(file, dotMm, dpi);
      const name = `${file.name.replace(/\.[^.]+$/, '')}-center-dot.pdf`;
      const record = { id: uuid(), name, sourceName: file.name, bytes, size: bytes.byteLength, createdAt: Date.now(), dotMm, dpi: type === 'pdf' ? null : dpi };
      await storeOutput(record);
      latestOutput = record;
      activePreviewId = record.id;
      showPreview(record);
      completed++;
    } catch (error) {
      console.error(error);
      failures.push(`${file.name}: ${error?.message || 'Could not process file'}`);
    }
  }
  await renderSavedOutputs();
  processButton.disabled = selectedFiles.length === 0;
  processButton.innerHTML = '<span>＋</span> Add center dots';
  if (failures.length) setStatus(`${completed} file(s) processed; ${failures.length} failed. ${failures.join(' | ')}`, 'warning');
  else setStatus(`${completed} file(s) processed successfully.${docxCount ? ` ${docxCount} DOCX file(s) were skipped; convert them locally to PDF first.` : ''}`, 'success');
}

processButton.addEventListener('click', processSelectedFiles);

$('jobMode').addEventListener('change', () => {
  const blankMode = $('jobMode').value === 'blank';
  $('blankSettings').hidden = !blankMode;
  dropzone.parentElement.querySelector('.dropzone').style.opacity = blankMode ? '.55' : '1';
  processButton.disabled = !blankMode && selectedFiles.length === 0;
  processButton.innerHTML = blankMode ? '<span>＋</span> Create blank PDF' : '<span>＋</span> Add center dots';
});
$('paperSize').addEventListener('change', () => {
  $('customDimensions').hidden = $('paperSize').value !== 'Custom';
});
$('jobMode').dispatchEvent(new Event('change'));

function blobFor(record) {
  return new Blob([record.bytes], { type: 'application/pdf' });
}

function showPreview(record) {
  if (latestObjectUrl) URL.revokeObjectURL(latestObjectUrl);
  latestObjectUrl = URL.createObjectURL(blobFor(record));
  pdfPreview.src = latestObjectUrl;
  previewName.textContent = record.name;
  previewEmpty.hidden = true;
  previewWrap.hidden = false;
  latestOutput = record;
  activePreviewId = record.id;
}

downloadButton.addEventListener('click', () => {
  if (!latestOutput) return;
  const url = URL.createObjectURL(blobFor(latestOutput));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = latestOutput.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

printButton.addEventListener('click', () => {
  if (!latestObjectUrl) return;
  pdfPreview.contentWindow?.focus();
  pdfPreview.contentWindow?.print();
});

async function renderSavedOutputs() {
  try {
    const records = await getOutputs();
    clearAllSavedButton.disabled = records.length === 0;
    if (!records.length) {
      savedList.innerHTML = '<p class="hint">No saved PDFs yet. Process a file to create one.</p>';
      return;
    }
    savedList.innerHTML = records.map(record => `<div class="saved-row">
      <div class="saved-file-icon">PDF</div>
      <div class="file-info"><strong title="${escapeHtml(record.name)}">${escapeHtml(record.name)}</strong><span>${new Date(record.createdAt).toLocaleString()} · ${prettyBytes(record.size)}</span></div>
      <div class="saved-actions"><button class="icon-button saved-open" data-id="${record.id}" title="Preview">↗</button><button class="icon-button saved-download" data-id="${record.id}" title="Download">↓</button><button class="icon-button saved-delete" data-id="${record.id}" title="Delete">×</button></div>
    </div>`).join('');
    savedList.querySelectorAll('.saved-open').forEach(button => button.addEventListener('click', async () => {
      const record = (await getOutputs()).find(item => item.id === button.dataset.id);
      if (record) showPreview(record);
    }));
    savedList.querySelectorAll('.saved-download').forEach(button => button.addEventListener('click', async () => {
      const record = (await getOutputs()).find(item => item.id === button.dataset.id);
      if (!record) return;
      const url = URL.createObjectURL(blobFor(record));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = record.name;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    savedList.querySelectorAll('.saved-delete').forEach(button => button.addEventListener('click', async () => {
      const recordId = button.dataset.id;
      if (!confirm('Delete this saved PDF from this browser?')) return;
      await deleteOutput(recordId);
      if (activePreviewId === recordId) {
        latestOutput = null;
        activePreviewId = null;
        if (latestObjectUrl) URL.revokeObjectURL(latestObjectUrl);
        latestObjectUrl = null;
        pdfPreview.removeAttribute('src');
        previewWrap.hidden = true;
        previewEmpty.hidden = false;
      }
      await renderSavedOutputs();
    }));
  } catch (error) {
    if (clearAllSavedButton) clearAllSavedButton.disabled = true;
    savedList.innerHTML = '<p class="hint error">Local storage is unavailable in this browser session.</p>';
  }
}

clearAllSavedButton.addEventListener('click', async () => {
  const records = await getOutputs();
  if (!records.length) {
    await renderSavedOutputs();
    return;
  }
  if (!confirm(`Delete all ${records.length} saved PDF(s) from this browser? This cannot be undone.`)) return;

  for (const record of records) await deleteOutput(record.id);

  if (activePreviewId && records.some(record => record.id === activePreviewId)) {
    latestOutput = null;
    activePreviewId = null;
    if (latestObjectUrl) URL.revokeObjectURL(latestObjectUrl);
    latestObjectUrl = null;
    pdfPreview.removeAttribute('src');
    previewWrap.hidden = true;
    previewEmpty.hidden = false;
  }

  await renderSavedOutputs();
  setStatus('All saved PDFs were deleted from this browser.', 'success');
});

$('refreshSaved').addEventListener('click', renderSavedOutputs);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(console.warn));
}

renderSavedOutputs();
