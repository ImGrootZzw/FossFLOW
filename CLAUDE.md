# FossFLOW（本项目）工作约定

这是一个 FossFLOW 的定制分支：等距（isometric）网络拓扑图画图工具，npm workspaces 单仓：

- `packages/fossflow-lib` — 画图组件库（rslib 构建，产物 `dist/`，应用启动前需先构建一次）
- `packages/fossflow-app` — RSBuild PWA 前端（`npm run dev`，端口 3000）
- `packages/fossflow-backend` — 可选 Express 后端（端口 3001，图表服务端存储）
- `mcp-server/` — 供 AI 会话调用的 MCP 服务（生成拓扑图 JSON）
- `icon-packs/` — 自定义图标包源文件（丢 SVG/PNG 进子目录即可）
- `scripts/generate-icon-packs.mjs` — 扫描 icon-packs 生成清单
- `scripts/sync.mjs` — 一键提交并推送

仓库：https://github.com/ImGrootZzw/FossFLOW （主分支 `main`，本地分支 `master`）

## 每次改动后必须提交并推送

**规则：任何代码/资源改动完成后，立刻执行**

```bash
node scripts/sync.mjs "<type>: <说明>"
```

它会 `git add -A` + commit + push 到 `ImGrootZzw/FossFLOW` 的 `main` 分支。
提交信息用 conventional 前缀（feat / fix / chore / docs）。

推送令牌读取顺序：环境变量 `GITHUB_TOKEN` → `.git/github-token`（本地文件，不随仓库分发）。
若脚本报告找不到令牌，仍然会完成本地提交，此时告知用户需要补令牌，不要静默跳过推送。

## 常用命令

- 启动开发服务：Windows 双击 `start-dev.bat`（自动装依赖、构建库、生成图标清单）
- 重新生成图标包：`npm run icons`
- 构建库：`npm run build:lib`；构建应用：`npm run build:app`
- 启动 MCP（手动调试）：`node mcp-server/index.js`

## 注意事项

- `.nvmrc` 里的 16.19.0 是过期信息，以 `package.json` 的 `engines`（Node ≥ 24）为准
- `packages/fossflow-app/public/icon-packs.generated.json` 是生成产物，已 gitignore，勿手工编辑
- `icon-packs/my-icon/` 里的 PNG 体积较大（单张 1MB+），新增图标建议压到 512px 以内
- 图标包内的图标文件不要重命名：旧图引用的是图标 id，改名会导致旧图丢图标
- 节点名称/描述显隐存在模型字段 `hideName` / `hideDescription`
- 节点拖拽手柄走交互模式 `NODE.TRANSFORM`（`interaction/modes/NodeTransform.ts`）

## 改动后的验证习惯

在沙盒里验证前，建议把源码复制到 `/tmp` 再 `npm install`（挂载盘上 npm 极慢），
构建 `npm run build:lib && npm run build:app` 后可用 puppeteer 冒烟。
