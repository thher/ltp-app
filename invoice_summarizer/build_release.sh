#!/usr/bin/env bash
# Build script for Smart Invoice Summarizer v0.4.0
# Usage: ./build_release.sh
#
# Prerequisites (all installed via: pip install -r requirements.txt):
#   PySide6, pdfplumber, PyMuPDF, openpyxl, reportlab, rapidfuzz, pandas, pytesseract
#   System: tesseract-ocr, tesseract-ocr-nor   (sudo apt install tesseract-ocr tesseract-ocr-nor)
#
# Output: dist/invoice-summarizer/   (directory bundle)
#         dist/invoice-summarizer.tar.gz  (portable archive)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

APP_NAME="invoice-summarizer"
VERSION="0.4.0"
DIST_DIR="$SCRIPT_DIR/dist/$APP_NAME"
ARCHIVE="$SCRIPT_DIR/dist/${APP_NAME}-${VERSION}-linux-x86_64.tar.gz"

echo "============================================================"
echo "  Smart Invoice Summarizer — Release Build v${VERSION}"
echo "============================================================"
echo ""

# ── 1. Pre-flight checks ────────────────────────────────────────────────────
echo "[1/5] Pre-flight checks..."

if ! command -v python &>/dev/null; then
    echo "ERROR: python not found. Install Python 3.11+."
    exit 1
fi

PYTHON_VER=$(python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "  Python: $PYTHON_VER"

for pkg in PySide6 openpyxl reportlab fitz pytesseract rapidfuzz; do
    python -c "import $pkg" 2>/dev/null \
        && echo "  ✓ $pkg" \
        || { echo "  ✗ $pkg — run: pip install -r requirements.txt"; exit 1; }
done

if ! command -v tesseract &>/dev/null; then
    echo "  WARNING: tesseract-ocr not found — OCR import will be disabled"
else
    echo "  ✓ tesseract $(tesseract --version 2>&1 | head -1 | awk '{print $2}')"
fi

# ── 2. Run tests ────────────────────────────────────────────────────────────
echo ""
echo "[2/5] Running test suite..."
python -m pytest tests/ -q --tb=short 2>&1 | tail -5
echo "  Tests complete."

# ── 3. Clean previous build ─────────────────────────────────────────────────
echo ""
echo "[3/5] Cleaning previous build..."
rm -rf build/ "$DIST_DIR"
echo "  Done."

# ── 4. PyInstaller ──────────────────────────────────────────────────────────
echo ""
echo "[4/5] Building with PyInstaller..."
python -m PyInstaller invoice_summarizer.spec \
    --clean \
    --noconfirm \
    2>&1

if [ ! -f "$DIST_DIR/$APP_NAME" ]; then
    echo "ERROR: Build failed — executable not found at $DIST_DIR/$APP_NAME"
    exit 1
fi

echo "  Build complete: $DIST_DIR"

# ── 5. Create archive ───────────────────────────────────────────────────────
echo ""
echo "[5/5] Creating archive..."
cd "$SCRIPT_DIR/dist"
tar -czf "${APP_NAME}-${VERSION}-linux-x86_64.tar.gz" "$APP_NAME/"
cd "$SCRIPT_DIR"
echo "  Archive: $ARCHIVE"

# ── Summary ─────────────────────────────────────────────────────────────────
EXEC_SIZE=$(du -sh "$DIST_DIR" | cut -f1)
ARCHIVE_SIZE=$(du -sh "$ARCHIVE" | cut -f1)

echo ""
echo "============================================================"
echo "  Build complete!"
echo ""
echo "  Executable:  $DIST_DIR/$APP_NAME"
echo "  Bundle size: $EXEC_SIZE"
echo "  Archive:     $ARCHIVE  ($ARCHIVE_SIZE)"
echo ""
echo "  Run the app:"
echo "    $DIST_DIR/$APP_NAME"
echo ""
echo "  Or extract the archive on a target machine:"
echo "    tar -xzf ${APP_NAME}-${VERSION}-linux-x86_64.tar.gz"
echo "    ./invoice-summarizer/invoice-summarizer"
echo "============================================================"
