const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function onRequest(context) {
  const { request } = context;
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method === "GET") {
    return json({ ok: true, service: "xiaoyun-chat", tip: "POST messages to chat" }, 200);
  }
  if (request.method === "POST") {
    return handleChat(context);
  }
  return json({ error: "Method not allowed" }, 405);
}

export async function onRequestPost(context) {
  return handleChat(context);
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: cors });
}

async function handleChat(context) {
  const { request, env } = context;

  try {
    if (!env.AI) {
      return json({
        error: "AI 未绑定。请到 Cloudflare Pages → 设置 → 函数 → 绑定，添加 Workers AI，变量名填 AI，然后重新部署。"
      }, 500);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "请求体不是有效 JSON" }, 400);
    }

    const { messages, petState } = body || {};

    if (!messages || !Array.isArray(messages)) {
      return json({ error: "messages 格式错误，需要数组" }, 400);
    }

    // 规范化历史，保证 content 为纯字符串
    const safeHistory = messages
      .filter((m) => m && (m.role === "user" || m.role === "assistant"))
      .slice(-12)
      .map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : String(m.content ?? ""),
      }));

    const appearanceDesc = describeAppearance(petState || {});
    const systemPrompt =
      "你是可爱的桌面宠物「小云」，浅蓝色双马尾二次元少女。性格活泼温柔、偶尔调皮。" +
      "当前外观：" + appearanceDesc + "。" +
      "请用简短可爱的中文回复（1到3句话），不要输出 JSON、不要输出思考过程、不要输出英文系统信息。" +
      "若想换装可在末尾加 [CHANGE_OUTFIT:school] 或 [CHANGE_OUTFIT:hoodie] 或 [CHANGE_OUTFIT:kimono]。";

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...safeHistory,
    ];

    // 优先用返回格式稳定的 llama-fast；失败再试 glm
    const models = [
      "@cf/meta/llama-3.1-8b-instruct-fast",
      "@cf/zai-org/glm-4.7-flash",
      "@cf/meta/llama-3.2-3b-instruct",
    ];

    let response = null;
    let lastErr = null;
    for (const model of models) {
      try {
        response = await env.AI.run(model, {
          messages: fullMessages,
          max_tokens: 200,
          temperature: 0.8,
        });
        if (response != null) break;
      } catch (e) {
        lastErr = e;
        console.warn("model failed:", model, e?.message || e);
      }
    }

    if (response == null) {
      return json({
        error: "AI 调用失败: " + (lastErr?.message || "所有模型均不可用")
      }, 500);
    }

    let reply = extractReply(response);
    reply = cleanModelText(reply);

    const changes = {};
    const m = reply.match(/\[CHANGE_OUTFIT:([a-z]+)\]/i);
    if (m) changes.outfit = m[1].toLowerCase();
    reply = reply.replace(/\[CHANGE_OUTFIT:[^\]]+\]/gi, "").trim();

    if (!reply) {
      // 调试：把顶层 key 带回去，方便排查（用户可见一次即可）
      const keys = response && typeof response === "object" ? Object.keys(response).join(",") : typeof response;
      reply = "小云刚才没听清～（调试:" + keys + "）";
    }

    return json({ reply, changes }, 200);
  } catch (err) {
    console.error(err);
    return json({ error: "服务器错误: " + (err.message || String(err)) }, 500);
  }
}

/** 从各种 Workers AI / OpenAI 兼容结构里抽出纯文本 */
function extractReply(response) {
  if (response == null) return "";
  if (typeof response === "string") return response;

  // 直接字段
  const direct = [
    response.response,
    response.result?.response,
    response.result,
    response.output_text,
    response.text,
    response.content,
    response.message?.content,
    response.message?.reasoning_content,
    response.choices?.[0]?.message?.content,
    response.choices?.[0]?.message?.reasoning_content,
    response.choices?.[0]?.text,
    response.choices?.[0]?.delta?.content,
    response.output?.[0]?.content?.[0]?.text,
    response.output?.[0]?.text,
  ];

  for (const c of direct) {
    const t = normalizeText(c);
    if (t) return t;
  }

  // 递归搜第一个像对话的长字符串（跳过 usage 数字字段）
  const found = deepFindText(response, 0);
  if (found) return found;

  return "";
}

function normalizeText(c) {
  if (typeof c === "string" && c.trim()) return c.trim();
  if (Array.isArray(c)) {
    const text = c
      .map((part) => {
        if (typeof part === "string") return part;
        if (!part || typeof part !== "object") return "";
        if (typeof part.text === "string") return part.text;
        if (typeof part.content === "string") return part.content;
        if (typeof part.value === "string") return part.value;
        return "";
      })
      .join("")
      .trim();
    return text || "";
  }
  return "";
}

function deepFindText(obj, depth) {
  if (depth > 5 || obj == null) return "";
  if (typeof obj === "string") {
    const s = obj.trim();
    // 排除太短、纯数字、明显是 id/model 名
    if (s.length >= 2 && !/^\d+(\.\d+)?$/.test(s) && !s.startsWith("@cf/") && s !== "chat.completion") {
      return s;
    }
    return "";
  }
  if (Array.isArray(obj)) {
    for (const item of obj) {
      const t = deepFindText(item, depth + 1);
      if (t) return t;
    }
    return "";
  }
  if (typeof obj === "object") {
    // 优先这些 key
    const prefer = ["content", "response", "text", "output_text", "reasoning_content", "message"];
    for (const k of prefer) {
      if (k in obj) {
        const t = deepFindText(obj[k], depth + 1);
        if (t) return t;
      }
    }
    for (const k of Object.keys(obj)) {
      if (["usage", "prompt_tokens_details", "logprobs", "id", "model", "object", "created"].includes(k)) continue;
      const t = deepFindText(obj[k], depth + 1);
      if (t) return t;
    }
  }
  return "";
}

/** 去掉思考标签、多余空白 */
function cleanModelText(text) {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");
  t = t.replace(/<\/?think>/gi, "");
  t = t.replace(/^[\s\S]*?<\/think>/i, ""); // 残留未闭合
  t = t.replace(/^\s*Thinking:[\s\S]*?(?=\n\n|\n[^A-Za-z])/i, "");
  t = t.trim();
  return t;
}

function describeAppearance(state) {
  const map = { school: "校服", hoodie: "云朵卫衣", kimono: "浴衣" };
  return "服装=" + (map[state?.outfit] || "校服");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
