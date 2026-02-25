# ✍︎ Handscript — Handwriting to Font

A browser-based tool to turn your handwriting into a custom font sheet.

## How to Run

1. Open this folder in VS Code
2. Install the **Live Server** extension (by Ritwick Dey) if you haven't already
3. Right-click `index.html` → **Open with Live Server**
4. The app opens at `http://127.0.0.1:5500`

## How to Use

1. **Draw** — Click any character button, draw it on the canvas, press **Save ✓**
2. **Preview** — Type in the preview box to see your handwriting rendered
3. **Export** — Download your glyphs as an SVG font sheet, or save progress as JSON

### Tips
- Draw large and centered on the canvas
- The red guideline is the baseline; the light line is the cap height
- Drag & drop your saved `handscript-progress.json` back onto the page to continue later
- The SVG font sheet can be converted to `.ttf` using [FontForge](https://fontforge.org) or online tools like [Calligraphr](https://www.calligraphr.com)

## Files
```
handwriting-font/
├── index.html
├── css/style.css
├── js/app.js
└── README.md
```
