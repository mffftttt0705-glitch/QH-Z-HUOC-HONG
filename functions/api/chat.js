
export async function onRequestPost(context) {
  const { request, env } = context;

  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    if (!env.AI) {
      return json({
        error: "AI 未绑定。请到 Pages 项目 → 设置 → 函数 → 绑定，添加 Workers AI，变量名填 AI，然后重新部署。"
      }, 500, cors);
    }

    const body = await request.json();
    const { messages, petState } = body || {};

    if (!messages || !Array.isArray(messages)) {
      return json({ error: "messages 格式错误" }, 400, cors);
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

    // 原 @cf/meta/llama-3.1-8b-instruct 已于 2026-05-30 弃用
    // 主模型：glm-4.7-flash（中文友好、推荐替代）；失败时 fallback 到 llama-3.1-8b-instruct-fast
    let response;
    try {
      response = await env.AI.run("@cf/zai-org/glm-4.7-flash", {
        messages: fullMessages,
        max_tokens: 400,
        temperature: 0.75,
      });
    } catch (e) {
      console.warn("glm failed, fallback to llama-fast", e);
      response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
        messages: fullMessages,
        max_tokens: 400,
        temperature: 0.75,
      });
    }

    let reply = "";
    if (typeof response === "string") reply = response;
    else if (response?.response) reply = response.response;
    else if (response?.result) reply = response.result;
    else if (response?.choices?.[0]?.message?.content) reply = response.choices[0].message.content;
    else reply = JSON.stringify(response);

    const changes = {};
    const m = reply.match(/\[CHANGE_OUTFIT:([a-z]+)\]/i);
    if (m) changes.outfit = m[1].toLowerCase();

    const cleanReply = reply.replace(/\[CHANGE_OUTFIT:[^\]]+\]/gi, "").trim();

    return json({
      reply: cleanReply || "嗯嗯，我在听哦～",
      changes,
    }, 200, cors);
  } catch (err) {
    console.error(err);
    return json({
      error: "AI 调用失败: " + (err.message || String(err))
    }, 500, cors);
  }
}

function describeAppearance(state) {
  const map = { school: "校服", hoodie: "云朵卫衣", kimono: "浴衣" };
  return `服装=${map[state?.outfit] || "校服"}`;
}

function json(data, status = 200, cors = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...cors },
  });
}
