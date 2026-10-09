#!/usr/bin/env bash
# 麦麦活动雷达 · 一句话安装脚本（macOS / Linux）
# 作用：把 Skill 文件放进 WorkBuddy 的用户级技能目录，不改其他任何文件。
# 重复运行 = 覆盖更新；卸载 = 删除 ~/.workbuddy/skills/mcd-event-radar 目录。
set -e

REPO="Zafer-Liu/mcd-event-radar"
SKILL="mcd-event-radar"
SKILLS_DIR="$HOME/.workbuddy/skills"
TARGET="$SKILLS_DIR/$SKILL"
TMP="$(mktemp -d)"

echo ""
echo "🍟 麦麦活动雷达 · 开始安装..."

# 1. 下载仓库压缩包（公开仓库，无需登录）
curl -fsSL "https://github.com/${REPO}/archive/refs/heads/main.zip" -o "$TMP/repo.zip"

# 2. 解压并安装 Skill 文件
unzip -qo "$TMP/repo.zip" -d "$TMP"
if [ ! -f "$TMP/$SKILL-main/skill/$SKILL/SKILL.md" ]; then
  echo "安装包里找不到 Skill 文件，可能下载不完整，请重试" >&2
  exit 1
fi
mkdir -p "$SKILLS_DIR"
rm -rf "$TARGET"
cp -r "$TMP/$SKILL-main/skill/$SKILL" "$TARGET"

# 3. 清理临时文件
rm -rf "$TMP"

echo ""
echo "✅ 安装完成：$TARGET"
echo ""
echo "下一步（约 2 分钟）："
echo "  1. 重启 WorkBuddy，或新开一轮会话"
echo "  2. 对它说：「查附近的活动」"
echo "  3. 按提示到 open.mcd.cn/mcp/doc 申请 Token，粘贴到对话里——剩下的它自己搞定"
echo ""
echo "⚠ Token 等同于账号凭证：只贴在自己的对话里，不要发群聊或公开场合。"
echo ""
