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
---

### 5. `worker/index.js`

```javascript
/**
 * Desktop Pet AI - Cloudflare Worker
 * Serves static assets + AI chat endpoint using Workers AI
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // AI Chat API
    if (url.pathname === "/api/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    // Pet state sync (optional KV)
    if (url.pathname === "/api/pet-state") {
      return handlePetState(request, env);
    }

    // Serve static assets
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function handleChat(request, env) {
  try {
    const body = await request.json();
    const { messages, petState } = body;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: "messages array required" }, 400);
    }

    // Build system prompt with pet personality + current appearance
    const appearanceDesc = describeAppearance(petState || {});
    const systemPrompt = `你是一个可爱的桌面宠物AI，名字叫「小云」。你活泼、温柔、偶尔调皮，喜欢和主人互动。
当前你的外观：${appearanceDesc}
你可以：
- 用简短可爱的语气回复（中文优先，也可以中英混合）
- 主动提议换装、捏脸（改变表情/发型/衣服）
- 表达情绪（开心、困、想玩等）
- 记住对话上下文
回复时如果想改变外观，可以在回复末尾用特殊标记：
[CHANGE_FACE:eyes=开心眼,mouth=微笑]
[CHANGE_OUTFIT:top=粉色卫衣,accessory=蝴蝶结]
可用部件见下方，只在合适时使用，不要每次都改。
可用眼睛: 默认, 开心眼, 困倦眼, 星星眼, 爱心眼, 惊讶眼
可用嘴巴: 默认, 微笑, 大笑, 嘟嘴, 惊讶
可用发型: 短发, 双马尾, 长直发, 卷发, 帽子
可用上衣: 默认白T, 粉色卫衣, 蓝色连衣裙, 校服, 休闲外套
可用配饰: 无, 蝴蝶结, 眼镜, 耳机, 围巾`;

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-20), // keep recent context
    ];

    // Use Workers AI - pick a capable small model for free tier friendliness
    const model = "@cf/meta/llama-3.1-8b-instruct";

    const response = await env.AI.run(model, {
      messages: fullMessages,
      max_tokens: 512,
      temperature: 0.8,
    });

    let reply = "";
    if (typeof response === "string") {
      reply = response;
    } else if (response?.response) {
      reply = response.response;
    } else if (response?.result) {
      reply = response.result;
    } else {
      reply = JSON.stringify(response);
    }

    // Parse optional appearance change commands
    const changes = parseChangeCommands(reply);
    // Clean the reply text
    const cleanReply = reply
      .replace(/\[CHANGE_FACE:[^\]]+\]/gi, "")
      .replace(/\[CHANGE_OUTFIT:[^\]]+\]/gi, "")
      .trim();

    return json({
      reply: cleanReply || "喵\~ 我在听呢！",
      changes,
    });
  } catch (err) {
    console.error("Chat error:", err);
    return json({ error: err.message || "AI 调用失败" }, 500);
  }
}

function describeAppearance(state) {
  const s = state || {};
  return `眼睛=\( {s.eyes || "默认"}, 嘴巴= \){s.mouth || "默认"}, 发型=\( {s.hair || "短发"}, 上衣= \){s.top || "默认白T"}, 配饰=${s.accessory || "无"}`;
}

function parseChangeCommands(text) {
  const changes = {};
  const faceMatch = text.match(/\[CHANGE_FACE:([^\]]+)\]/i);
  if (faceMatch) {
    faceMatch[1].split(",").forEach((pair) => {
      const [k, v] = pair.split("=").map((x) => x.trim());
      if (k && v) changes[k] = v;
    });
  }
  const outfitMatch = text.match(/\[CHANGE_OUTFIT:([^\]]+)\]/i);
  if (outfitMatch) {
    outfitMatch[1].split(",").forEach((pair) => {
      const [k, v] = pair.split("=").map((x) => x.trim());
      if (k && v) changes[k] = v;
    });
  }
  return changes;
}

async function handlePetState(request, env) {
  // Optional KV persistence. Without KV just echo success.
  if (!env.PET_KV) {
    return json({ ok: true, message: "KV not configured, using client storage only" });
  }

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || "default";

  if (request.method === "GET") {
    const data = await env.PET_KV.get(`pet:${userId}`, "json");
    return json(data || {});
  }

  if (request.method === "POST") {
    const body = await request.json();
    await env.PET_KV.put(`pet:${userId}`, JSON.stringify(body));
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}