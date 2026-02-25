// ════════════════════════════════════════════════════════════════════════
//  ttf-generator.js  —  Canvas pixels → vector contours → real .ttf file
//  Uses opentype.js (loaded via CDN in index.html)
// ════════════════════════════════════════════════════════════════════════

const TTF_UNITS = 1000;   // font units per em (standard)
const CANVAS_SIZE = 300;  // our draw canvas px size

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 1: Pixel → binary bitmap
// ─────────────────────────────────────────────────────────────────────────────
function imageDataToBitmap(imageData) {
  const { data, width, height } = imageData;
  const grid = [];
  for (let y = 0; y < height; y++) {
    grid[y] = new Uint8Array(width);
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      // Dark pixel = ink (r+g+b average < 128, and not background)
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      grid[y][x] = avg < 160 ? 1 : 0;
    }
  }
  return { grid, width, height };
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 2: Marching squares — extract contour polygons from bitmap
// ─────────────────────────────────────────────────────────────────────────────
function extractContours(bitmap) {
  const { grid, width, height } = bitmap;

  // Pad grid by 1 pixel on each side with 0s
  function at(x, y) {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return grid[y][x];
  }

  const visited = new Set();
  const contours = [];

  // Find all contour starting points using marching squares
  // We trace outer boundaries of connected ink regions
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!at(x, y)) continue;
      // Check if this is a boundary pixel (adjacent to a 0)
      const isBoundary = !at(x-1,y) || !at(x+1,y) || !at(x,y-1) || !at(x,y+1);
      if (!isBoundary) continue;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;

      // Trace contour starting here
      const contour = traceContour(at, x, y, width, height, visited);
      if (contour.length >= 4) contours.push(contour);
    }
  }
  return contours;
}

function traceContour(at, startX, startY, width, height, visited) {
  // Simple boundary follower (Moore neighborhood tracing)
  const points = [];
  let x = startX, y = startY;

  // Direction vectors for Moore neighborhood (clockwise from right)
  const dirs = [[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]];

  let prevDir = 6; // start looking left-up
  const startKey = `${x},${y}`;
  let steps = 0;
  const maxSteps = width * height;

  do {
    visited.add(`${x},${y}`);
    points.push([x, y]);

    // Look for next boundary pixel starting from backtrack direction
    let found = false;
    const startLook = (prevDir + 5) % 8; // backtrack ~135 degrees
    for (let i = 0; i < 8; i++) {
      const di = (startLook + i) % 8;
      const nx = x + dirs[di][0];
      const ny = y + dirs[di][1];
      if (at(nx, ny)) {
        prevDir = di;
        x = nx; y = ny;
        found = true;
        break;
      }
    }
    if (!found) break;
    steps++;
  } while (!(x === startX && y === startY) && steps < maxSteps);

  return points;
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 3: Simplify polygon (Ramer-Douglas-Peucker)
// ─────────────────────────────────────────────────────────────────────────────
function rdp(points, epsilon) {
  if (points.length < 3) return points;

  let maxDist = 0, maxIdx = 0;
  const [x1, y1] = points[0];
  const [x2, y2] = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDistance(points[i], [x1,y1], [x2,y2]);
    if (d > maxDist) { maxDist = d; maxIdx = i; }
  }

  if (maxDist > epsilon) {
    const left  = rdp(points.slice(0, maxIdx + 1), epsilon);
    const right = rdp(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[points.length - 1]];
}

function pointToLineDistance([px, py], [x1, y1], [x2, y2]) {
  const dx = x2 - x1, dy = y2 - y1;
  const len2 = dx*dx + dy*dy;
  if (len2 === 0) return Math.hypot(px - x1, py - y1);
  const t = ((px - x1)*dx + (py - y1)*dy) / len2;
  return Math.hypot(px - (x1 + t*dx), py - (y1 + t*dy));
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 4: Convert pixel contours → opentype.js Path
// ─────────────────────────────────────────────────────────────────────────────
function contoursToOpentypePath(contours, canvasW, canvasH) {
  const path = new opentype.Path();

  // Coordinate transform:
  //   canvas origin: top-left, y-down
  //   font units origin: baseline, y-up
  //   We map canvas [0..300] → font units [0..TTF_UNITS]
  //   Baseline sits at 20% from bottom → y_baseline_canvas = 0.8 * canvasH
  const scale = TTF_UNITS / canvasH;
  const baseline = 0.8 * canvasH; // where baseline sits in canvas px

  function tx(x) { return Math.round(x * scale); }
  function ty(y) { return Math.round((baseline - y) * scale); } // flip y

  contours.forEach(rawContour => {
    // Simplify
    const simplified = rdp(rawContour, 2.0);
    if (simplified.length < 3) return;

    path.moveTo(tx(simplified[0][0]), ty(simplified[0][1]));
    for (let i = 1; i < simplified.length; i++) {
      path.lineTo(tx(simplified[i][0]), ty(simplified[i][1]));
    }
    path.close();
  });

  return path;
}

// ─────────────────────────────────────────────────────────────────────────────
//  STEP 5: Build the actual opentype.Font and export .ttf ArrayBuffer
// ─────────────────────────────────────────────────────────────────────────────
function buildTTF(glyphMap, fontName) {
  fontName = fontName || 'Handscript';

  // Required: .notdef glyph
  const notdefGlyph = new opentype.Glyph({
    name: '.notdef',
    advanceWidth: TTF_UNITS * 0.5,
    path: new opentype.Path()
  });

  // Space glyph
  const spaceGlyph = new opentype.Glyph({
    name: 'space',
    unicode: 32,
    advanceWidth: Math.round(TTF_UNITS * 0.35),
    path: new opentype.Path()
  });

  const glyphs = [notdefGlyph, spaceGlyph];

  Object.entries(glyphMap).forEach(([char, imageData]) => {
    const unicode = char.codePointAt(0);
    const bitmap = imageDataToBitmap(imageData);
    const contours = extractContours(bitmap);
    const path = contoursToOpentypePath(contours, CANVAS_SIZE, CANVAS_SIZE);

    // Measure ink bounding box for advance width
    const inkPixels = [];
    const { grid, width, height } = bitmap;
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++)
        if (grid[y][x]) inkPixels.push(x);

    const minX = inkPixels.length ? Math.min(...inkPixels) : 0;
    const maxX = inkPixels.length ? Math.max(...inkPixels) : width * 0.5;
    const scale = TTF_UNITS / CANVAS_SIZE;
    const advanceWidth = Math.round((maxX + 20) * scale); // slight right margin

    glyphs.push(new opentype.Glyph({
      name: glyphName(char),
      unicode,
      advanceWidth: Math.max(advanceWidth, 100),
      path
    }));
  });

  const font = new opentype.Font({
    familyName: fontName,
    styleName: 'Regular',
    unitsPerEm: TTF_UNITS,
    ascender: Math.round(TTF_UNITS * 0.8),
    descender: Math.round(-TTF_UNITS * 0.2),
    glyphs
  });

  return font.download ? font : { _font: font, buffer: font.arrayBuffer() };
}

function glyphName(char) {
  if (char >= 'A' && char <= 'Z') return char;
  if (char >= 'a' && char <= 'z') return char;
  if (char >= '0' && char <= '9') return 'uni' + char.codePointAt(0).toString(16).padStart(4,'0');
  const names = { '.': 'period', ',': 'comma', '!': 'exclam', '?': 'question' };
  return names[char] || ('uni' + char.codePointAt(0).toString(16).padStart(4,'0'));
}

// ─────────────────────────────────────────────────────────────────────────────
//  PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────
window.TTFGenerator = {
  /**
   * @param {Object} glyphMap  { char: ImageData }
   * @param {string} fontName
   * @returns opentype.Font
   */
  build(glyphMap, fontName) {
    return buildTTF(glyphMap, fontName);
  },

  /**
   * Build and trigger download of .ttf file
   */
  download(glyphMap, fontName) {
    if (Object.keys(glyphMap).length === 0) {
      alert('Draw at least one character before generating the font!');
      return;
    }
    fontName = fontName || 'Handscript';
    try {
      const font = buildTTF(glyphMap, fontName);
      font.download(fontName + '.ttf');
    } catch (e) {
      console.error('TTF generation error:', e);
      alert('Font generation failed: ' + e.message + '\n\nCheck console for details.');
    }
  }
};
