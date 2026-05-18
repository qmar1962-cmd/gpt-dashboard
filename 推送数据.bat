@echo off
chcp 65001 >nul
cd /d "C:\Users\0347\Documents\trae_projects\1\GPT2\GPT 每日通报可视化看板"

echo ==============================
echo  GPT 看板数据自动推送脚本
echo ==============================
echo.

:: 检查是否有变更（git diff --quiet 有变更时返回 1）
git diff --quiet -- public/database/ 2>nul
if "%errorlevel%"=="0" (
    git diff --quiet --cached -- public/database/ 2>nul
    if "%errorlevel%"=="0" (
        echo [检查] public/database/ 没有新变更，无需推送。
        pause
        exit /b 0
    )
)

echo [1/4] 添加数据文件...
git add public/database/
if not "%errorlevel%"=="0" (
    echo [错误] git add 失败，请检查文件是否被占用。
    pause
    exit /b 1
)

echo [2/4] 提交变更...
git commit -m "data: 更新数据"
if not "%errorlevel%"=="0" (
    echo [错误] git commit 失败。
    pause
    exit /b 1
)

echo [3/4] 推送到 GitHub...
git push
if not "%errorlevel%"=="0" (
    echo.
    echo [错误] git push 失败！
    echo.
    echo 常见原因：
    echo   1. 网络连接问题（代理 443 端口错误）
    echo   2. GitHub 认证失效
    echo.
    echo 请截图此窗口发给 AI 助手协助排查。
    pause
    exit /b 1
)

echo.
echo ==============================
echo [成功] 数据已推送到 GitHub！
echo.
echo Netlify 正在自动部署（约 1-2 分钟）...
echo 部署完成后按 Ctrl+F5 强制刷新页面。
echo.
echo 线上地址： https://liuyang0347.netlify.app
echo ==============================
pause
