# 快捷复制回复（uTools 插件）

一个面向客服场景的 uTools 快捷回复插件：
- 快速搜索常用回复
- 一键复制 / 尝试自动插入到当前输入框
- 支持变量占位符（如 `{{客户姓名}}`）
- 支持图片随回复管理与逐张复制

适用于电商客服、售后支持、社群运营等高频文字回复场景。

---

## 项目简介

本项目用于解决“重复回复耗时、容易出错、回复素材分散”的问题。

核心思路：
1. 把常用回复结构化存储（标题、分类、标签、正文、变量、图片）
2. 通过关键词快速检索
3. 在发送时按需填充变量
4. 提供两种执行策略：
   - **置顶复制**：稳定性高，复制后手动粘贴
   - **自动插入**：隐藏插件并尝试直接粘贴，失败时自动降级到复制

---

## 功能特性

- 回复管理
  - 新建 / 编辑 / 删除回复
  - 支持标题、分类、标签、正文
- 分类管理
  - 新增 / 重命名 / 删除 / 上下排序
  - 删除分类时支持将回复迁移到其他分类
- 变量系统
  - 正文中使用 `{{变量名}}`
  - 发送前弹窗填写变量并替换
- 搜索能力
  - 基于 Fuse.js 的模糊搜索（标题、标签、正文）
  - 无搜索词时按使用次数排序
- 复制与插入
  - 一键复制文本
  - 自动插入（含失败重试和兜底）
- 图片支持
  - 回复可携带多张图片
  - 发送文本后可逐张复制图片
  - 大图自动压缩后存储

---

## 技术栈

- 前端框架：Vue 3
- 状态管理：Pinia
- 路由：Vue Router（Hash 路由）
- 构建工具：Vite
- 富文本编辑：Tiptap（内部转为纯文本存储）
- 搜索：Fuse.js
- ID 生成：uuid
- 宿主能力：uTools API（`copyText` / `hideMainWindowPasteText` / `db` 等）

---

## 目录结构

> 省略了 `node_modules` 与构建产物细节，仅展示核心源码。

```text
快捷复制回复/
├─ public/
│  ├─ plugin.json           # uTools 插件清单（名称、入口、features、dev 入口）
│  ├─ preload.js            # 注入 window.preload，封装 uTools 能力
│  └─ preload/
│     └─ index.js           # 当前为空文件
├─ src/
│  ├─ components/
│  │  ├─ AnswerCard.vue     # 单条回复卡片（复制/插入操作）
│  │  ├─ AnswerEditor.vue   # 回复编辑弹窗（标题、内容、标签、图片）
│  │  ├─ AnswerList.vue     # 回复列表容器
│  │  ├─ CategorySidebar.vue# 分类侧边栏（切换/管理）
│  │  ├─ ImageViewer.vue    # 图片预览与逐张复制
│  │  ├─ SearchBar.vue      # 顶部搜索框与快捷键交互
│  │  └─ VarFillModal.vue   # 变量填写弹窗
│  ├─ pages/
│  │  ├─ Main.vue           # 主面板（搜索、列表、复制/插入流程）
│  │  └─ Admin.vue          # 管理页（回复与分类管理）
│  ├─ router/
│  │  └─ index.js           # 路由配置（/ 与 /admin）
│  ├─ stores/
│  │  ├─ answers.js         # 回复数据状态与 CRUD
│  │  └─ categories.js      # 分类状态与 CRUD/排序/校验
│  ├─ types/
│  │  └─ global.d.ts        # 全局类型声明
│  ├─ utils/
│  │  ├─ clipboard.js       # 复制/插入核心流程 + 兜底策略
│  │  ├─ db.js              # AnswerDB/CategoryDB，封装 uTools db
│  │  ├─ mock-preload.js    # 非 uTools 环境下的本地 mock
│  │  ├─ search.js          # Fuse.js 搜索索引与查询
│  │  ├─ tag-color.js       # 标签颜色工具
│  │  └─ variables.js       # 变量解析与替换
│  ├─ App.vue               # 根据 onPluginEnter 切路由
│  ├─ main.css              # 全局样式与主题变量
│  └─ main.js               # 应用入口（Pinia、Router、Store 初始化）
├─ dist/                    # 构建产物（用于打包）
├─ index.html
├─ package.json
├─ vite.config.js
└─ jsconfig.json
```

---

## 开发与运行

### 1) 安装依赖

```bash
npm install
```

### 2) 本地开发

```bash
npm run dev
```

说明：
- 默认启动 Vite 开发服务器（通常是 `http://localhost:5173`）
- `public/plugin.json` 中 `development.main` 已指向该地址
- 在 uTools 开发模式下可直接加载进行联调

### 3) 构建

```bash
npm run build
```

构建后产物在 `dist/`。

---

## 发布到 uTools

### 打包内容

通常需要把以下文件/目录打包为 zip：
- `dist/`（前端构建产物）
- `public/plugin.json`（或确保最终包根目录有 `plugin.json`）
- `public/preload.js`（或确保最终包根目录有 `preload.js`）

> 实际以 uTools 插件打包规范为准，关键是最终插件根目录可正确找到：
> - `plugin.json`
> - `preload.js`
> - 前端入口（`index.html` 与 `assets`）

### 发布建议流程

1. 执行 `npm run build`
2. 检查 `plugin.json` 的版本号、命令词、入口是否正确
3. 按 uTools 要求整理并压缩发布包
4. 在 uTools 开发者工具中导入测试
5. 验证以下关键场景：
   - 复制成功率
   - 自动插入（至少在微信/浏览器输入框各测一轮）
   - 变量替换正确性
   - 图片复制可用性

---

## 使用说明（简版）

1. 在主面板输入关键词检索回复
2. 选择回复后：
   - 点击“复制”：复制文本到剪贴板
   - 点击“插入”：按当前策略执行（自动插入或降级复制）
3. 若正文存在变量：先弹窗填写，再执行
4. 若含图片：文本处理后可在图片预览层逐张复制

---

## 注意事项

- 自动插入依赖系统焦点、目标应用行为和 uTools API，无法保证 100% 命中
- 图片与文本在部分应用（如微信）常需分步操作
- uTools db 存储容量有限，建议控制单条回复内图片数量和体积

---

## License

如需开源可在此补充 License（当前项目未声明）。
