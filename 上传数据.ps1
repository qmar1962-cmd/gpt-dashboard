# GPT 每日通报 - 数据上传脚本
# 使用方法：右键本文件 → "使用 PowerShell 运行"

$ErrorActionPreference = "Stop"
$ProjectDir = "C:\Users\0347\Documents\trae_projects\1\GPT2\GPT 每日通报可视化看板"

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "  GPT 每日通报 - 数据上传脚本" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目目录
Set-Location $ProjectDir

# 检查是否有文件变动
$status = git status --porcelain
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] Git 命令执行失败，请检查是否在正确目录" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 如果没有变动，提示用户
if (-not $status) {
    Write-Host "[提示] 没有检测到数据变动，无需上传。" -ForegroundColor Yellow
    Write-Host "请先将新的 Excel 文件放入 public\database\ 目录。" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "按 Enter 退出"
    exit 0
}

# 显示将要提交的文件
Write-Host "[信息] 检测到以下文件变动：" -ForegroundColor Green
git status --short
Write-Host ""

# 询问用户是否继续
$confirm = Read-Host "确认上传以上文件到 GitHub？(Y/N)"
if ($confirm -ne "Y") {
    Write-Host "[取消] 操作已取消。" -ForegroundColor Yellow
    Read-Host "按 Enter 退出"
    exit 0
}

# 提交并推送
Write-Host ""
Write-Host "[步骤 1/3] 添加文件到 Git..." -ForegroundColor Cyan
git add -A
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] git add 失败" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

Write-Host "[步骤 2/3] 提交变更..." -ForegroundColor Cyan
$commitMsg = "data: 更新数据 $(Get-Date -Format 'yyyy-MM-dd HH:mm')"
git commit -m $commitMsg
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] git commit 失败" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

Write-Host "[步骤 3/3] 推送到 GitHub..." -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "[错误] git push 失败，请检查网络连接或 VPN 状态" -ForegroundColor Red
    Read-Host "按 Enter 退出"
    exit 1
}

# 成功
Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "  [成功] 数据已上传到 GitHub！" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "请等待 1-2 分钟让 GitHub 自动部署..." -ForegroundColor Yellow
Write-Host "网站地址：https://qmar1962-cmd.github.io/gpt-dashboard/" -ForegroundColor Cyan
Write-Host ""
Write-Host "你可以在以下地址查看部署进度：" -ForegroundColor Yellow
Write-Host "https://github.com/qmar1962-cmd/gpt-dashboard/actions" -ForegroundColor Cyan
Write-Host ""
Read-Host "按 Enter 退出"
