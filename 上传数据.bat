@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

set PROJECT_DIR=C:\Users\0347\Documents\trae_projects\1\GPT2\GPT 每日通报可视化看板

echo ===============================================
echo   GPT 每日通报 - 数据上传脚本
echo ===============================================
echo.

cd /d "%PROJECT_DIR%"
if errorlevel 1 (
    echo [错误] 无法进入项目目录
    pause
    exit /b 1
)

REM 检查 git 状态
git status --porcelain > %temp%\git_status.txt 2>&1
set /p STATUS=<%temp%\git_status.txt

if "%STATUS%"=="" (
    echo [提示] 没有检测到数据变动，无需上传。
    echo 请先将新的 Excel 文件放入 public\database\ 目录。
    echo.
    pause
    exit /b 0
)

REM 显示变动文件
echo [信息] 检测到以下文件变动：
git status --short
echo.

REM 确认
set /p CONFIRM=确认上传以上文件到 GitHub？(Y/N^):
if /i not "%CONFIRM%"=="Y" (
    echo [取消] 操作已取消。
    pause
    exit /b 0
)

echo.
echo [步骤 1/3] 添加文件到 Git...
git add -A
if errorlevel 1 (
    echo [错误] git add 失败
    pause
    exit /b 1
)

echo [步骤 2/3] 提交变更...
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set TDATE=%%c-%%a-%%b
for /f "tokens=1-2 delims=:" %%a in ('time /t') do set TTIME=%%a%%b
git commit -m "data: update data %TDATE% %TTIME%"
if errorlevel 1 (
    echo [错误] git commit 失败
    pause
    exit /b 1
)

echo [步骤 3/3] 推送到 GitHub...
git push
if errorlevel 1 (
    echo [错误] git push 失败，请检查网络连接或 VPN 状态
    pause
    exit /b 1
)

echo.
echo ===============================================
echo   [成功] 数据已上传到 GitHub！
echo ===============================================
echo.
echo 请等待 1-2 分钟让 GitHub 自动部署...
echo 网站地址：https://qmar1962-cmd.github.io/gpt-dashboard/
echo.
echo 查看部署进度：https://github.com/qmar1962-cmd/gpt-dashboard/actions
echo.
pause
