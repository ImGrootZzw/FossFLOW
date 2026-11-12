# 自定义图标包（Custom Icon Packs）

有两种方式添加自定义图标包：

1. **应用内导入**（最简单）：运行中的界面里，打开「设置 → Icon Pack Management」，
   在「Import Image Library」区域输入包名、选择本机 PNG/SVG 图片即可。
   导入的包保存在浏览器 IndexedDB 里，重启应用后仍在；包列表里可随时删除。
2. **icon-packs 目录**（适合批量/随仓库分发）：见下方说明。

把 SVG/PNG 图标文件丢进这个目录的子文件夹里，就是一个新的图标包，
**不需要改任何代码**。生成的图标会出现在应用的「设置 → Icon Packs」页面里，
和内置的 AWS / Azure / GCP / Kubernetes 包一样可以开关。

> 两种方式的区别：应用内导入的包只存在于当前浏览器（IndexedDB）；
> 目录方式的包会生成到项目文件里，换浏览器、换机器（连项目一起拷贝）都可用。

## 快速上手

1. 在 `icon-packs/` 下新建一个文件夹，文件夹名就是包 id（建议英文、不含空格），
   例如 `icon-packs/my-icons/`
2. 把图标文件（`.svg` `.png` `.webp` `.jpg` `.gif`）丢进去
3. 重新生成：`npm run icons`（用 `start-dev.bat` 启动的话会自动执行，无需手动跑）
4. 启动应用，打开「设置 → Icon Packs」，勾选你的包即可

`example-iso/` 是一个示例包（3 个手绘等距图标），可以删掉或照着改。

## pack.json（可选）

每个包目录里可以放一个 `pack.json` 控制包的显示和默认行为：

```json
{
  "name": "显示名称（设置页里展示，默认用文件夹名）",
  "isIsometric": true,
  "scale": 1,
  "icons": {
    "文件名不带扩展名": {
      "name": "覆盖这个图标的显示名",
      "isIsometric": false,
      "scale": 1.5
    }
  }
}
```

## 关于 isIsometric（立体感的关键）

这个开关决定图标在画布上的姿态：

- `true`  → **直立站立**（像立牌一样立在网格上，有立体感；核心 isoflow 图标就是这种）
- `false` → **平贴地面**（图标带等距透视斜贴在地面上，AWS/Azure/GCP/K8s 包全是这种）

平面的 logo 图（比如厂商官方图标）想要立体感，就把 `isIsometric` 设为 `true`。
可以在 pack.json 里整包设置，也可以单个图标覆盖。

## 命名规则与注意事项

- 图标 id = `<文件夹名>-<文件名>`（会做安全字符过滤）；
  图标显示名 = 文件名（`-` 和 `_` 转为空格），可在 pack.json 里覆盖
- **不要重命名已放入图表的图标文件**：旧图里存的是图标 id，改名后旧图会丢图标
- id/显示名最长 100 字符；scale 范围 0.1 ~ 3
- 图标以 base64 形式打进 `icon-packs.generated.json`，文件越大包越大，
  建议 SVG 控制在几十 KB 以内
- 生成产物是 `packages/fossflow-app/public/icon-packs.generated.json`（自动生成，勿手改）

## 相关命令

- `npm run icons` — 重新扫描 icon-packs/ 并生成
- `npm run dev` / `start-dev.bat` — 启动前自动重新生成
