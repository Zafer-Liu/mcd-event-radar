# 麦麦活动雷达 · 一句话安装脚本（Windows）
# 作用：把 Skill 文件放进 WorkBuddy 的用户级技能目录，不改其他任何文件。
# 重复运行 = 覆盖更新；卸载 = 删除 %USERPROFILE%\.workbuddy\skills\mcd-event-radar 文件夹。
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$repo      = 'Zafer-Liu/mcd-event-radar'
$skillName = 'mcd-event-radar'
$skillsDir = Join-Path $env:USERPROFILE '.workbuddy\skills'
$target    = Join-Path $skillsDir $skillName
$tmp       = Join-Path ([System.IO.Path]::GetTempPath()) 'mcd-event-radar-install'

Write-Host ''
Write-Host '🍟 麦麦活动雷达 · 开始安装...' -ForegroundColor Yellow

# 1. 下载仓库压缩包（公开仓库，无需登录）
$zip = "$tmp.zip"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
Invoke-WebRequest -Uri "https://github.com/$repo/archive/refs/heads/main.zip" -OutFile $zip -UseBasicParsing

# 2. 解压并安装 Skill 文件
Expand-Archive -Path $zip -DestinationPath $tmp -Force
$src = Join-Path $tmp "$skillName-main\skill\$skillName"
if (-not (Test-Path (Join-Path $src 'SKILL.md'))) {
    throw '安装包里找不到 Skill 文件，可能下载不完整，请重试'
}
New-Item -ItemType Directory -Force -Path $skillsDir | Out-Null
if (Test-Path $target) { Remove-Item -Recurse -Force $target }
Copy-Item -Recurse -Force $src $target

# 3. 清理临时文件
Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
Remove-Item -Force $zip -ErrorAction SilentlyContinue

Write-Host ''
Write-Host "✅ 安装完成：$target" -ForegroundColor Green
Write-Host ''
Write-Host '下一步（约 2 分钟）：' -ForegroundColor Cyan
Write-Host '  1. 重启 WorkBuddy，或新开一轮会话'
Write-Host '  2. 对它说：「查附近的活动」'
Write-Host '  3. 按提示到 open.mcd.cn/mcp/doc 申请 Token，粘贴到对话里——剩下的它自己搞定'
Write-Host ''
Write-Host '⚠ Token 等同于账号凭证：只贴在自己的对话里，不要发群聊或公开场合。'
Write-Host ''
