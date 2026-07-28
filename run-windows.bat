@echo off
REM ===================================================================
REM  Hoc tieng Anh moi ngay - chay tren Windows
REM
REM  Bam dup vao file nay. Trinh duyet se tu mo app.
REM  Khong can cai Python, Node hay bat cu thu gi khac.
REM
REM  De dong: bam Ctrl+C trong cua so nay, hoac dong cua so.
REM ===================================================================

chcp 65001 >nul 2>nul
cd /d "%~dp0"
title Hoc tieng Anh moi ngay

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\serve.ps1" %*

if errorlevel 1 (
    echo.
    echo   Co loi xay ra khi khoi dong. Xem thong bao o tren.
    echo   Nhan phim bat ky de dong cua so nay...
    pause >nul
)
