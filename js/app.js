// ─── Characters to collect ───────────────────────────────────────────────────
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?'.split('');

// ─── State ────────────────────────────────────────────────────────────────────
const savedGlyphs = {}; // char → { imageData }
let currentChar = null;
let isDrawing = false;
let lastX = 0, lastY = 0;

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const charGrid      = document.getElementById('charGrid');
const canvas        = document.getElementById('drawCanvas');
const ctx           = canvas.getContext('2d');
const clearBtn      = document.getElementById('clearBtn');
const saveBtn       = document.getElementById('saveCharBtn');
const charLabel     = document.getElementById('currentCharLabel');
const savedCount    = document.getElementById('savedCount');
const totalCount    = document.getElementById('totalCount');
const progFill      = document.getElementById('progFill');
const fontNameInput = document.getElementById('fontName');
const previewCanvas = document.getElementById('previewCanvas');
const previewInput  = document.getElementById('previewInput');
const pctx          = previewCanvas.getContext('2d');

totalCount.textContent = CHARS.length;

// ─── Build character grid ─────────────────────────────────────────────────────
CHARS.forEach(c => {
  const btn = document.createElement('button');
  btn.className = 'char-btn';
  btn.textContent = c;
  btn.title = `Draw "${c}"`;
  btn.dataset.char = c;
  btn.addEventListener('click', () => selectChar(c, btn));
  charGrid.appendChild(btn);
});

function selectChar(c, btn) {
  document.querySelectorAll('.char-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentChar = c;
  charLabel.textContent = `Drawing: "${c}"`;
  clearCanvas(false);
  if (savedGlyphs[c]) ctx.putImageData(savedGlyphs[c].imageData, 0, 0);
}

// ─── Canvas drawing ───────────────────────────────────────────────────────────
function clearCanvas(resetSaved = true) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#faf8f4';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
clearCanvas();

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width, sy = canvas.height / rect.height;
  if (e.touches) return [(e.touches[0].clientX - rect.left)*sx, (e.touches[0].clientY - rect.top)*sy];
  return [(e.clientX - rect.left)*sx, (e.clientY - rect.top)*sy];
}

function startDraw(e) {
  if (!currentChar) { showToast('Select a character first!'); return; }
  isDrawing = true;
  [lastX, lastY] = getPos(e);
  ctx.beginPath();
  ctx.arc(lastX, lastY, 2.5, 0, Math.PI*2);
  ctx.fillStyle = '#1a1816';
  ctx.fill();
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const [x, y] = getPos(e);
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = '#1a1816';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  [lastX, lastY] = [x, y];
}

function stopDraw() { isDrawing = false; }

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseleave', stopDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', stopDraw);
clearBtn.addEventListener('click', () => clearCanvas());

// ─── Save character ───────────────────────────────────────────────────────────
saveBtn.addEventListener('click', () => {
  if (!currentChar) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  let hasInk = false;
  for (let i = 0; i < imageData.data.length; i += 4) {
    if (imageData.data[i] < 160) { hasInk = true; break; }
  }
  if (!hasInk) { showToast('Draw the character first!'); return; }

  savedGlyphs[currentChar] = { imageData };
  charGrid.querySelector(`[data-char="${CSS.escape(currentChar)}"]`)?.classList.add('done');
  updateProgress();
  drawPreview(previewInput.value);

  saveBtn.textContent = 'Saved! ✓';
  saveBtn.style.background = '#6ecf6e';
  setTimeout(() => { saveBtn.textContent = 'Save ✓'; saveBtn.style.background = ''; }, 900);

  // Auto-advance
  const idx = CHARS.indexOf(currentChar);
  for (let i = idx+1; i < CHARS.length; i++) {
    if (!savedGlyphs[CHARS[i]]) {
      charGrid.querySelector(`[data-char="${CSS.escape(CHARS[i])}"]`)?.click();
      break;
    }
  }
});

// ─── Progress ─────────────────────────────────────────────────────────────────
function updateProgress() {
  const n = Object.keys(savedGlyphs).length;
  savedCount.textContent = n;
  progFill.style.width = (n / CHARS.length * 100) + '%';
}

// ─── Live preview ─────────────────────────────────────────────────────────────
previewInput.addEventListener('input', () => drawPreview(previewInput.value));

function drawPreview(text) {
  if (!text) { previewCanvas.style.opacity = '0'; return; }
  previewCanvas.style.opacity = '1';

  const glyphH = 72, glyphW = 72, gap = 6;
  const lineH = glyphH + 12;
  const containerW = previewCanvas.parentElement?.offsetWidth || 700;
  const maxCols = Math.floor(containerW / (glyphW + gap)) || 1;
  const chars = [...text];
  const rows = Math.ceil(chars.length / maxCols);

  previewCanvas.width  = maxCols * (glyphW + gap);
  previewCanvas.height = rows * lineH + 16;
  pctx.fillStyle = '#13120f';
  pctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  chars.forEach((c, i) => {
    const col = i % maxCols, row = Math.floor(i / maxCols);
    const x = col * (glyphW + gap), y = row * lineH + 8;
    if (c === ' ') return;
    if (savedGlyphs[c]) {
      const tmp = document.createElement('canvas');
      tmp.width = 300; tmp.height = 300;
      tmp.getContext('2d').putImageData(savedGlyphs[c].imageData, 0, 0);
      pctx.drawImage(tmp, x, y, glyphW, glyphH);
    } else {
      pctx.fillStyle = 'rgba(163,158,150,0.1)';
      pctx.fillRect(x, y, glyphW, glyphH);
      pctx.fillStyle = '#555';
      pctx.font = `${Math.round(glyphH*0.5)}px 'DM Mono',monospace`;
      pctx.textAlign = 'center'; pctx.textBaseline = 'middle';
      pctx.fillText(c, x+glyphW/2, y+glyphH/2);
    }
  });
}

// ─── Download .ttf ────────────────────────────────────────────────────────────
document.getElementById('downloadTtf').addEventListener('click', () => {
  if (!Object.keys(savedGlyphs).length) { showToast('Draw at least one character first!'); return; }

  const btn = document.getElementById('downloadTtf');
  btn.textContent = '⏳ Building font…';
  btn.disabled = true;

  setTimeout(() => {
    try {
      const glyphMap = {};
      Object.entries(savedGlyphs).forEach(([c, g]) => { glyphMap[c] = g.imageData; });
      const name = fontNameInput?.value.trim() || 'Handscript';
      TTFGenerator.download(glyphMap, name);
      showToast(`✓ ${name}.ttf downloaded!`);
    } catch(err) {
      console.error(err);
      showToast('Generation failed — see console.');
    } finally {
      btn.textContent = '⬇ Download .ttf Font';
      btn.disabled = false;
    }
  }, 50);
});

// ─── Download SVG sheet ───────────────────────────────────────────────────────
document.getElementById('downloadSvg').addEventListener('click', () => {
  const chars = Object.keys(savedGlyphs);
  if (!chars.length) { showToast('Draw at least one character first!'); return; }
  const cols = 8, cell = 310;
  const rows = Math.ceil(chars.length / cols);
  const W = cols*cell+40, H = rows*cell+80;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}">`;
  svg += `<rect width="100%" height="100%" fill="#faf8f4"/>`;
  svg += `<text x="20" y="48" font-family="serif" font-size="26" fill="#1a1816">Handscript — Font Sheet</text>`;
  chars.forEach((c, i) => {
    const col = i%cols, row = Math.floor(i/cols);
    const x = 20+col*cell, y = 60+row*cell;
    const tmp = document.createElement('canvas'); tmp.width=300; tmp.height=300;
    tmp.getContext('2d').putImageData(savedGlyphs[c].imageData,0,0);
    svg += `<rect x="${x}" y="${y}" width="300" height="300" fill="white" stroke="#ddd" rx="6"/>`;
    svg += `<image x="${x}" y="${y}" width="300" height="300" href="${tmp.toDataURL('image/png')}"/>`;
    svg += `<text x="${x+150}" y="${y+316}" text-anchor="middle" font-family="monospace" font-size="13" fill="#999">${escXml(c)}</text>`;
  });
  svg += '</svg>';
  downloadBlob(new Blob([svg], {type:'image/svg+xml'}), 'handscript-sheet.svg');
});

// ─── Save/load JSON ───────────────────────────────────────────────────────────
document.getElementById('downloadJson').addEventListener('click', () => {
  const out = {};
  Object.entries(savedGlyphs).forEach(([c,g]) => {
    const tmp = document.createElement('canvas'); tmp.width=300; tmp.height=300;
    tmp.getContext('2d').putImageData(g.imageData,0,0);
    out[c] = tmp.toDataURL('image/png');
  });
  downloadBlob(new Blob([JSON.stringify(out)],{type:'application/json'}), 'handscript-progress.json');
});

document.addEventListener('dragover', e => e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (!file?.name.endsWith('.json')) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      Promise.all(Object.entries(data).map(([c,uri]) => new Promise(res => {
        const img = new Image();
        img.onload = () => {
          const tmp = document.createElement('canvas'); tmp.width=300; tmp.height=300;
          const tc = tmp.getContext('2d'); tc.fillStyle='#faf8f4'; tc.fillRect(0,0,300,300);
          tc.drawImage(img,0,0);
          savedGlyphs[c] = { imageData: tc.getImageData(0,0,300,300) };
          charGrid.querySelector(`[data-char="${CSS.escape(c)}"]`)?.classList.add('done');
          res();
        };
        img.src = uri;
      }))).then(() => { updateProgress(); showToast(`Loaded ${Object.keys(savedGlyphs).length} chars!`); });
    } catch { showToast('Invalid JSON file.'); }
  };
  reader.readAsText(file);
});

// ─── Utilities ────────────────────────────────────────────────────────────────
function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function escXml(c) {
  return c.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'toast';
    t.style.cssText = `position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);
      background:#e8c97e;color:#0f0e0c;padding:10px 22px;border-radius:8px;
      font-family:'DM Mono',monospace;font-size:0.85rem;font-weight:500;
      z-index:9999;opacity:0;transition:opacity 0.2s;pointer-events:none;white-space:nowrap;`;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}
