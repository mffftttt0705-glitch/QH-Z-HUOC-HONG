/**
 * Cloudflare Pages Function - /api/chat
 * 使用 Workers AI 进行对话
 */

export async function onRequestPost(context) {
  const { request, env } = context;

  // CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    const body = await request.json();
    const { messages, petState } = body;

    if (!messages || !Array.isArray(messages)) {
      return json({ error: "messages array required" }, 400);
    }

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
      ...messages.slice(-20),
    ];

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

    const changes = parseChangeCommands(reply);
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

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}