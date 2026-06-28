# AI-CONTEXT.md

> 目标：给 AI 快速建立全局上下文。把本文件直接丢给 AI，即可在当前代码基础上继续开发。

---

## 1) 项目是什么、解决什么问题

这是一个 **uTools 客服快捷回复插件**（Vue 3 + Pinia + Vite）。

要解决的问题：
- 客服高频重复回复耗时
- 内容不统一、易出错
- 变量信息（客户名、订单号）人工改写易漏改
- 图文素材分散，不便快速发送

核心能力：
- 回复模板管理（标题/分类/标签/内容/图片）
- 模糊搜索快速命中
- 变量占位替换（`{{变量}}`）
- 一键复制 + 可选自动插入
- 图片逐张复制辅助发送

---

## 2) 完整目录结构与文件职责

```text
快捷复制回复/
├─ public/
│  ├─ plugin.json
│  │  └─ uTools 插件配置：名称、入口、命令词、dev 入口
│  ├─ preload.js
│  │  └─ 挂载 window.preload，封装 uTools API（db/copy/paste/hotkey/窗口控制）
│  └─ preload/
│     └─ index.js（空文件）
├─ src/
│  ├─ App.vue
│  │  └─ 监听 onPluginEnter/onPluginOut，按 feature code 切 / 或 /admin
│  ├─ main.js
│  │  └─ 创建 app、挂载 pinia/router、初始化 stores、全局 errorHandler
│  ├─ main.css
│  │  └─ 全局样式变量/主题
│  ├─ router/
│  │  └─ index.js：路由 / => Main, /admin => Admin
│  ├─ pages/
│  │  ├─ Main.vue
│  │  │  └─ 主面板：搜索、分类筛选、复制/插入、变量弹窗、图片查看、分类删除迁移
│  │  └─ Admin.vue
│  │     └─ 管理页：回复 CRUD、分类 CRUD + 排序
│  ├─ stores/
│  │  ├─ answers.js
│  │  │  └─ 回复 store：初始化种子、查询、保存、删除、使用次数+1、跨分类迁移
│  │  └─ categories.js
│  │     └─ 分类 store：初始化“未分类”、新增/重命名/删除/排序、合法性校验
│  ├─ utils/
│  │  ├─ db.js
│  │  │  └─ AnswerDB/CategoryDB：封装 uTools db，处理 answer 与 imageRefs 的拆分存储
│  │  ├─ clipboard.js
│  │  │  └─ copyFlow/insertFlow/copyImage：复制、自动插入、兜底与重试
│  │  ├─ variables.js
│  │  │  └─ parseVariables/fillVariables：变量提取和文本替换
│  │  ├─ search.js
│  │  │  └─ Fuse.js 索引构建与检索
│  │  ├─ mock-preload.js
│  │  │  └─ 非 uTools 环境 mock（localStorage 模拟 db）
│  │  └─ tag-color.js
│  │     └─ 标签颜色辅助
│  ├─ components/
│  │  ├─ SearchBar.vue：搜索与键盘事件
│  │  ├─ CategorySidebar.vue：分类栏与管理动作
│  │  ├─ AnswerList.vue：列表容器
│  │  ├─ AnswerCard.vue：单卡片展示与操作
│  │  ├─ VarFillModal.vue：变量填写
│  │  ├─ ImageViewer.vue：图片预览与逐张复制
│  │  └─ AnswerEditor.vue：编辑弹窗（标题/正文/标签/图片上传压缩）
│  └─ types/
│     └─ global.d.ts：全局类型声明
├─ dist/
│  └─ 构建产物（发布使用）
├─ package.json
├─ vite.config.js（base: './'）
├─ index.html
└─ jsconfig.json
```

---

## 3) 核心数据结构（完整字段）

> 说明：Answer/Category 最终存入 uTools db，图片使用独立 image 文档并由 `imageRefs` 关联。

### Answer（业务对象）

```ts
interface Answer {
  _id: string                 // 形如 ans_xxx
  type: 'answer'
  title: string
  categoryId: string
  tags: string[]
  content: string             // 纯文本，可含 {{变量}}
  variables: string[]         // 由 content 解析生成
  images: Array<{             // 运行态/编辑态使用
    id: string                // 形如 img_xxx
    name: string
    dataUrl: string
  }>
  useCount: number
  createdAt: string           // ISO 时间
  updatedAt: string           // ISO 时间

  // 持久化时存在（由 db.js 维护）
  imageRefs?: string[]        // 图片文档 id 列表
}
```

### Category

```ts
interface Category {
  _id: string                 // 形如 cat_xxx
  type: 'category'
  name: string
  icon: string                // 当前默认 📁
  order: number               // 排序号，越小越靠前
  createdAt: string           // ISO 时间
  updatedAt: string           // ISO 时间
}
```

### ImageDoc（db 内部文档）

```ts
interface ImageDoc {
  _id: string                 // img_xxx
  type: 'image'
  answerId: string
  name: string
  dataUrl: string
  updatedAt: string
}
```

---

## 4) 关键业务逻辑

### 4.1 复制流程（copyFlow）

入口：`src/utils/clipboard.js::copyFlow(answer, vars)`

流程：
1. `fillVariables(answer.content, vars)` 生成 `finalText`
2. 优先 `utools.copyText(finalText)`，否则 `navigator.clipboard.writeText`
3. 成功后 `answersStore.incrementUseCount(answer._id)`
4. 返回 `finalText`

在页面层（Main.vue）：
- 若存在变量，先打开 `VarFillModal`
- 文本复制成功后，如有图片则打开 `ImageViewer` 进行逐张复制

### 4.2 插入流程（insertFlow）

入口：`src/utils/clipboard.js::insertFlow(answer, vars, strategy)`

策略：
- `strategy === 'copy'`：直接走复制兜底，用户手动粘贴
- `strategy === 'auto'`：尝试自动插入

自动插入具体步骤：
1. `hideMainWindow()` 先隐藏插件窗口
2. `sleep(220)` 给目标输入框恢复焦点时间
3. 调 `hideMainWindowPasteText(finalText)`，失败后 `sleep(140)` 再重试一次
4. 若仍失败：`copyText(finalText)` + `simulatePasteHotkey()` 作为二级兜底
5. 全部失败则返回复制提示文案

### 4.3 变量替换流程

文件：`src/utils/variables.js`

- `parseVariables(content)`：正则提取 `{{...}}` 并去重
- `fillVariables(content, vars)`：按 key 替换，未提供值默认空字符串

触发路径：
- Main 的复制/插入前都先调用 `parseVariables`
- 有变量则弹 `VarFillModal`
- 确认后再调用 `copyFlow` 或 `insertFlow`

### 4.4 图片处理方案

编辑阶段（`AnswerEditor.vue`）：
- 支持文件选择与拖拽
- 当 `file.size > 300KB` 时，canvas 压缩为 JPEG（质量约 0.7）
- 转为 dataUrl 存入 `form.images`

存储阶段（`db.js`）：
- 保存 Answer 时把 images 拆成独立 `image` 文档
- Answer 主文档只保存 `imageRefs`
- 读取 Answer 时再根据 `imageRefs` 回填 `images`

发送阶段（`ImageViewer.vue` + `copyImage`）：
- 一次只复制当前图片
- 成功后自动切到下一张
- 优先 `utools.copyImage(dataUrl)`，否则浏览器 Clipboard API

---

## 5) 已知限制 & 已解决坑

### 已解决/已规避

1. 自动插入命中率问题（尤其窗口焦点切换）
   - 已采用“隐藏窗口 + 延时 + 重试 + 热键兜底”多层策略
   - 同时保留“置顶复制”稳定模式

2. 非 uTools 环境无法运行
   - 已通过 `mock-preload.js` 提供本地开发 mock（db/hide/show/isDev）

3. 图片直接塞 Answer 文档导致读写与管理不便
   - 已改为 `image` 子文档 + `imageRefs` 关联

### 已知限制（当前代码层面）

1. 自动插入并非 100% 成功
   - 受操作系统焦点、目标应用输入控件、权限策略影响

2. 微信等 IM 场景通常不支持“图文一次性粘贴”
   - 当前方案为：先文本，再逐张复制图片

3. uTools db 容量有限（常见经验值约 1MB 级别）
   - 当前通过图片压缩与文档拆分缓解，但仍需控制素材体积

4. 变量替换为纯文本替换
   - 无变量类型校验、无默认值配置、无格式化规则

---

## 6) 当前未完成 / 可扩展功能清单

1. 导入/导出（JSON）
   - 便于团队模板迁移与备份

2. 回收站/软删除
   - 防止误删回复与分类

3. 变量增强
   - 变量默认值、必填校验、变量类型（日期/手机号/金额）

4. 图片能力增强
   - 批量复制策略、图片顺序拖拽、压缩参数可配置

5. 统计与运营
   - 热门回复排行、最近使用、分类使用分析

6. 搜索增强
   - 高级过滤（分类+标签交叉筛选）、拼音匹配、高亮优化

7. 协作能力
   - 云同步/多端同步、团队共享模板

8. 稳定性
   - 增加关键流程埋点和错误上报，定位自动插入失败场景

---

## 7) 开发注意事项

1. **优先保持数据兼容**
   - Answer 存储结构涉及 `images` ↔ `imageRefs` 转换，改动需写迁移逻辑

2. **插入逻辑谨慎改动**
   - `insertFlow` 的延时与兜底顺序是现有稳定性关键，不要随意删除

3. **分类删除必须先迁移**
   - 现实现已保证删除前迁移回复，避免悬挂 `categoryId`

4. **变量来源以 content 为准**
   - `variables` 字段应由 `parseVariables(content)` 自动生成

5. **控制图片体积**
   - 高分辨率截图容易撑爆 db，若扩展图片能力需同时考虑限流与压缩

6. **本地开发与 uTools 环境差异**
   - 浏览器 mock 不等于真实行为，插入/复制相关能力要在 uTools 实测

7. **路由入口依赖 feature code**
   - `plugin.json` 中 feature 的 `code`（`main`/`admin`）与 `App.vue` 逻辑要保持一致

---

## 8) 快速继续开发建议（给下一个 AI）

接手时建议先做：
1. 阅读 `src/utils/clipboard.js`、`src/utils/db.js`、`src/pages/Main.vue`
2. 跑通“新增回复 → 变量替换 → 复制/插入 → 图片复制”完整链路
3. 先在 mock 环境开发，再到 uTools 实机验证

如果要新增功能，优先顺序建议：
- 先数据结构与 store，再页面交互，最后补充迁移与回归测试。
