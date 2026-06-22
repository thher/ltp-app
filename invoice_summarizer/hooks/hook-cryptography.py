# Local override: suppress the upstream hook that crashes on system-installed
# cryptography (Rust/cffi bindings built for a different interpreter).
# pdfminer/pdfplumber import cryptography at runtime; the system .so works fine
# when launched directly — we just prevent PyInstaller from trying to bundle it.
hiddenimports = []
binaries = []
datas = []
