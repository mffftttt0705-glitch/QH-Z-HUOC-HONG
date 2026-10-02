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

    const appearanceDesc = describeAppearance(petState || {});
    const systemPrompt = `你是可爱的桌面宠物「小云」（Xiaoyun），浅蓝色双马尾二次元少女。性格活泼温柔、偶尔调皮，喜欢和主人互动。
当前外观：${appearanceDesc}
用简短可爱的中文回复（1-3句），可以主动提换装。
如果想换装，在回复末尾加标记（不要每次都加）：
[CHANGE_OUTFIT:school] 或 [CHANGE_OUTFIT:hoodie] 或 [CHANGE_OUTFIT:kimono]
可用服装: school(校服), hoodie(云朵卫衣), kimono(浴衣)`;

    const fullMessages = [
      { role: "system", content: systemPrompt },
      ...messages.slice(-16),
    ];

    let response;
    try {
      response = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
        messages: fullMessages,
        max_tokens: 256,
        temperature: 0.75,
      });
    } catch (e1) {
      console.warn("glm failed, try llama-fast", e1?.message || e1);
      try {
        response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
          messages: fullMessages,
          max_tokens: 256,
          temperature: 0.75,
        });
      } catch (e2) {
        return json({
          error: "AI 调用失败: " + (e2?.message || e1?.message || String(e2))
        }, 500);
      }
    }

    const reply = extractReply(response);
    const changes = {};
    const m = reply.match(/\[CHANGE_OUTFIT:([a-z]+)\]/i);
    if (m) changes.outfit = m[1].toLowerCase();

    const cleanReply = reply.replace(/\[CHANGE_OUTFIT:[^\]]+\]/gi, "").trim();

    return json({
      reply: cleanReply || "嗯嗯，我在听哦～",
      changes,
    }, 200);
  } catch (err) {
    console.error(err);
    return json({
      error: "服务器错误: " + (err.message || String(err))
    }, 500);
  }
}

function extractReply(response) {
  if (response == null) return "";
  if (typeof response === "string") return response.trim();

  const candidates = [
    response.response,
    response.result?.response,
    response.result,
    response.output_text,
    response.text,
    response.content,
    response.message?.content,
    response.choices?.[0]?.message?.content,
    response.choices?.[0]?.text,
    response.choices?.[0]?.delta?.content,
  ];

  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (Array.isArray(c)) {
      const text = c
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part.text === "string") return part.text;
          if (part && typeof part.content === "string") return part.content;
          return "";
        })
        .join("")
        .trim();
      if (text) return text;
    }
  }

  console.warn("extractReply unknown shape", JSON.stringify(response).slice(0, 400));
  return "小云脑子有点懵，再说一遍好不好～";
}

function describeAppearance(state) {
  const map = { school: "校服", hoodie: "云朵卫衣", kimono: "浴衣" };
  return `服装=${map[state?.outfit] || "校服"}`;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
