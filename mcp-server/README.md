# FossFLOW MCP Server

让任意支持 MCP 的 AI 会话直接生成网络拓扑图，产物是 FossFLOW 可直接打开的 JSON。

零依赖，走 stdio（换行分隔的 JSON-RPC 2.0）。

## 配置

### Claude Desktop

编辑 `%APPDATA%\Claude\claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "fossflow": {
      "command": "node",
      "args": [
        "D:\\Project\\SL_Project\\_tools\\FossFLOW-backup-stan-smith-FossFLOW\\mcp-server\\index.js"
      ]
    }
  }
}
```

> 路径按实际仓库位置调整；改完重启 Claude Desktop。

### Claude Code / CLI

```bash
claude mcp add fossflow -- node "D:/Project/SL_Project/_tools/FossFLOW-backup-stan-smith-FossFLOW/mcp-server/index.js"
```

### 自定义输出目录

设置环境变量 `FOSSFLOW_TOPOLOGIES_DIR`（默认 `<仓库>/topologies/`）。

## 工具

| 工具 | 作用 |
| --- | --- |
| `create_topology` | 用节点 + 连线生成/覆盖一张图 |
| `list_topologies` | 列出已生成的图 |
| `get_topology` | 读取一张图（`full: true` 返回完整 JSON） |
| `delete_topology` | 删除一张图 |
| `list_icons` | 列出可用的内置图标 id 与别名 |

### create_topology 参数

```jsonc
{
  "name": "Office LAN",          // 图名，同时决定文件名 office-lan.json
  "overwrite": false,            // 同名文件已存在时需显式覆盖
  "nodes": [
    {
      "id": "fw",                // 连线引用这个 id
      "label": "Firewall",       // 显示在图标下方
      "icon": "firewall",        // 见 list_icons
      "description": "可选说明",
      "x": 0, "y": 0             // 可选，省略则自动布局
    }
  ],
  "links": [
    {
      "from": "fw",
      "to": "sw",
      "label": "WAN",            // 可选
      "color": "color1",         // color1..color6
      "style": "SOLID",          // SOLID | DOTTED | DASHED
      "arrow": true,
      "via": [{ "x": 2, "y": -2 }] // 可选折线路径点
    }
  ]
}
```

自动布局：按有向图分层（无入边的节点为第 0 层），层间 X 间距 4，同层 Y 间距 4，
最后整体平移到原点附近，保证打开即可见。

## 图标

内置核心图标（`collection: isoflow`）：

`server` `storage` `switch-module` `router` `firewall` `cloud` `loadbalancer`
`dns` `vm` `desktop` `laptop` `mobiledevice` `printer` `tower` `user`
`queue` `cache` `lock` `mail` `mailmultiple` `office` `cube` `sphere`
`pyramid` `diamond` `document` `image` `plane` `truck` `truck-2`
`cardterminal` `paymentcard` `function-module` `package-module` `cronjob`
`speech` `block` `isoflow`

常用别名：`database`/`db`/`nas` → `storage`，`switch`/`sw` → `switch-module`，
`lb` → `loadbalancer`，`ap`/`wifi` → `tower`，`gateway` → `router`，
`pc`/`computer` → `desktop`，`phone`/`mobile` → `mobiledevice`，
`person` → `user`，`web`/`app`/`api` → `server`。

使用自定义图标包时，图里可直接引用其 id（形如 `<包目录>-<文件名>`），
只要该图标包已在应用中启用即可。

## 打开生成的图

FossFLOW 里点左下角汉堡菜单 → **Open** → 选择 `topologies/<name>.json`。

> 也可以把文件拖到 `diagrams/` 目录配合后端存储（`ENABLE_SERVER_STORAGE=true`）实现多端共享。

## 手动调试

```bash
node mcp-server/index.js
# 然后逐行输入 JSON-RPC，例如：
{"jsonrpc":"2.0","id":1,"method":"tools/list"}
```
