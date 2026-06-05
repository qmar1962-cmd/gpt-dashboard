@echo off
cd /d "%~dp0.."
python data-pipeline/process_data.py
pause
