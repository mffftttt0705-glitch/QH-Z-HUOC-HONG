# ☁️ 小云 · 桌宠 AI

可直接用 **GitHub + Cloudflare** 一键部署的可爱桌面宠物。

- 🖱️ 拖拽互动、右键捏脸/换装
- 🤖 自主说话、换表情、换装
- 💬 Cloudflare Workers AI 对话（带人格，可主动换装）
- 📱 支持 PWA，可添加到手机主屏幕

---

## 方式一：GitHub 连接 Cloudflare 部署（推荐，手机也能操作）

### 1. 上传到 GitHub
1. 打开 [GitHub](https://github.com) → 新建仓库（例如 `desktop-pet-ai`），选 **Public**
2. 把本项目所有文件上传上去（可直接网页上传，或用 GitHub App / 电脑上传）

### 2. 在 Cloudflare 连接 GitHub
1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → 左侧 **Workers 和 Pages**
2. 点 **创建** → 选 **通过 Git 连接**（或 Create Worker → Connect to Git）
3. 授权 GitHub，选择你刚创建的仓库
4. 配置建议：
   - **项目名称**：`desktop-pet-ai`（随便起）
   - **生产分支**：`main`（或你的默认分支）
   - Cloudflare 会自动识别根目录的 `wrangler.toml`
5. 部署完成后，会得到类似链接：
6. 打开链接就能用（含 AI 对话）

> 首次部署后，在 Worker 设置里确认 **AI** 绑定已启用（`wrangler.toml` 里已写好 `[ai] binding = "AI"`）。

### 3. 以后更新
只要往 GitHub 推送代码，Cloudflare 会自动重新部署。

---

## 方式二：本地命令行部署

```bash
cd desktop-pet-ai
npm install
npx wrangler login
npx wrangler deploy