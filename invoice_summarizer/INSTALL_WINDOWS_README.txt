Smart Invoice Summarizer v0.4.0 — Windows Quick-Start
======================================================

PREREQUISITES
-------------
  - Windows 10 (1709 or newer) or Windows 11
  - Internet connection during setup

SETUP (one-time)
----------------
  1. Right-click INSTALL_WINDOWS.ps1
     Select "Run with PowerShell"

     If you see an execution-policy error, open PowerShell and run:
       Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
       .\invoice_summarizer\INSTALL_WINDOWS.ps1

  The script will:
    - Check Python 3.11+ (tells you how to install if missing)
    - Check git (tells you how to install if missing)
    - Clone / update the project into:  %USERPROFILE%\SmartInvoiceSummarizer
    - Create a Python virtual environment
    - Install all Python packages from requirements.txt
    - Install Tesseract OCR via winget (for Norwegian PDF scanning)
    - Write run.bat to launch the app

RUNNING THE APP
---------------
  After setup, double-click:
    %USERPROFILE%\SmartInvoiceSummarizer\invoice_summarizer\run.bat

  Or open a terminal in that folder and type:  run.bat

IF PYTHON IS NOT INSTALLED
--------------------------
  Option A (recommended):
    Open PowerShell and run:
      winget install Python.Python.3.11
    Restart the terminal, then re-run INSTALL_WINDOWS.ps1

  Option B:
    Download from https://www.python.org/downloads/
    During installation, check "Add Python to PATH".

IF GIT IS NOT INSTALLED
-----------------------
  Open PowerShell and run:
    winget install Git.Git
  Restart the terminal, then re-run INSTALL_WINDOWS.ps1

IF TESSERACT FAILS
------------------
  Download the UB Mannheim installer from:
    https://github.com/UB-Mannheim/tesseract/wiki
  During installation, enable the Norwegian language pack.
  The default install path is:
    C:\Program Files\Tesseract-OCR\tesseract.exe
  run.bat adds this to PATH automatically.

DATA LOCATION
-------------
  All invoices and the database are stored in:
    %USERPROFILE%\SmartInvoiceSummarizer\invoice_summarizer\data\
  Back this folder up regularly.

UPDATING
--------
  Re-run INSTALL_WINDOWS.ps1 at any time — it will pull the latest
  code and re-install dependencies without losing your data.
