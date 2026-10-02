/**
 * 小云 Desktop Pet AI - Frontend
 * 支持拖拽、捏脸、换装、自主行为、AI 对话
 */

const OPTIONS = {
  eyes: [
    { id: "默认", label: "● ●", css: "●" },
    { id: "开心眼", label: "^ ^", css: "◠" },
    { id: "困倦眼", label: "- -", css: "–" },
    { id: "星星眼", label: "★ ★", css: "★" },
    { id: "爱心眼", label: "♡ ♡", css: "♡" },
    { id: "惊讶眼", label: "◎ ◎", css: "◎" },
  ],
  mouth: [
    { id: "默认", label: "ᴗ", css: "ᴗ" },
    { id: "微笑", label: "◡", css: "◡" },
    { id: "大笑", label: "ω", css: "ω" },
    { id: "嘟嘴", label: "ω̃", css: "з" },
    { id: "惊讶", label: "o", css: "o" },
  ],
  hair: [
    { id: "短发", label: "短发", class: "", color: "#4c1d95" },
    { id: "双马尾", label: "双马尾", class: "pigtails", color: "#7c3aed" },
    { id: "长直发", label: "长直发", class: "long", color: "#312e81" },
    { id: "卷发", label: "卷发", class: "curly", color: "#581c87" },
    { id: "帽子", label: "帽子", class: "hat", color: "#4c1d95" },
  ],
  top: [
    { id: "默认白T", label: "白T", color: "#fef3c7" },
    { id: "粉色卫衣", label: "粉卫衣", color: "#fbcfe8" },
    { id: "蓝色连衣裙", label: "蓝裙", color: "#bfdbfe" },
    { id: "校服", label: "校服", color: "#e0e7ff" },
    { id: "休闲外套", label: "外套", color: "#a7f3d0" },
  ],
  accessory: [
    { id: "无", label: "无", emoji: "" },
    { id: "蝴蝶结", label: "🦋结", emoji: "🎀" },
    { id: "眼镜", label: "眼镜", emoji: "👓" },
    { id: "耳机", label: "耳机", emoji: "🎧" },
    { id: "围巾", label: "围巾", emoji: "🧣" },
  ],
};

const DEFAULT_STATE = {
  eyes: "默认",
  mouth: "默认",
  hair: "短发",
  top: "默认白T",
  accessory: "无",
  x: null,
  y: null,
};

let state = loadState();
let chatHistory = [];
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let autoTimer = null;
let bubbleTimer = null;

// ========== DOM ==========
const petEl = document.getElementById("pet");
const bubbleEl = document.getElementById("bubble");
const panelEl = document.getElementById("panel");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const quickInput = document.getElementById("quick-input");
const sendBtn = document.getElementById("send-btn");

// ========== Init ==========
function init() {
  applyAppearance();
  positionPet();
  buildOptionGrids();
  bindEvents();
  startAutoBehavior();
  addChatMsg("system", "小云已上线\~ 拖我移动，右键打开衣柜，或直接聊天！");
  showBubble("你好呀主人～ ☁️", 3000);
}

function loadState() {
  try {
    const raw = localStorage.getItem("desktop-pet-state");
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_STATE };
}

function saveState() {
  localStorage.setItem("desktop-pet-state", JSON.stringify(state));
}

function positionPet() {
  if (state.x != null && state.y != null) {
    petEl.style.left = state.x + "px";
    petEl.style.top = state.y + "px";
  } else {
    petEl.style.left = "calc(50% - 70px)";
    petEl.style.top = "40%";
  }
}

// ========== Appearance ==========
function applyAppearance() {
  // Eyes
  const eyeOpt = OPTIONS.eyes.find((o) => o.id === state.eyes) || OPTIONS.eyes[0];
  document.documentElement.style.setProperty("--eye-char", `"${eyeOpt.css}"`);

  // Mouth
  const mouthOpt = OPTIONS.mouth.find((o) => o.id === state.mouth) || OPTIONS.mouth[0];
  document.documentElement.style.setProperty("--mouth-char", `"${mouthOpt.css}"`);

  // Hair
  const hairEl = document.getElementById("hair");
  hairEl.className = "layer hair";
  const hairOpt = OPTIONS.hair.find((o) => o.id === state.hair) || OPTIONS.hair[0];
  if (hairOpt.class) hairEl.classList.add(hairOpt.class);
  document.documentElement.style.setProperty("--hair-color", hairOpt.color);

  // Top color
  const topOpt = OPTIONS.top.find((o) => o.id === state.top) || OPTIONS.top[0];
  document.documentElement.style.setProperty("--top-color", topOpt.color);

  // Accessory
  const accEl = document.getElementById("accessory");
  const accOpt = OPTIONS.accessory.find((o) => o.id === state.accessory) || OPTIONS.accessory[0];
  accEl.textContent = accOpt.emoji;
}

function setPart(part, value) {
  state[part] = value;
  applyAppearance();
  saveState();
  // highlight buttons
  document.querySelectorAll(`#opt-${part} .option-btn`).forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.id === value);
  });
}

function buildOptionGrids() {
  ["eyes", "mouth", "hair", "top", "accessory"].forEach((part) => {
    const container = document.getElementById(`opt-${part}`);
    if (!container) return;
    container.innerHTML = "";
    OPTIONS[part].forEach((opt) => {
      const btn = document.createElement("button");
      btn.className = "option-btn" + (state[part] === opt.id ? " active" : "");
      btn.dataset.id = opt.id;
      btn.textContent = opt.label;
      btn.onclick = () => setPart(part, opt.id);
      container.appendChild(btn);
    });
  });
}

// ========== Drag ==========
function bindEvents() {
  // Drag
  petEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    petEl.setPointerCapture(e.pointerId);
    const rect = petEl.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    e.preventDefault();
  });

  petEl.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;
    petEl.style.left = Math.max(0, Math.min(window.innerWidth - 140, x)) + "px";
    petEl.style.top = Math.max(0, Math.min(window.innerHeight - 160, y)) + "px";
  });

  petEl.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    petEl.releasePointerCapture(e.pointerId);
    state.x = parseInt(petEl.style.left);
    state.y = parseInt(petEl.style.top);
    saveState();
    // click feedback
    petEl.classList.add("happy");
    setTimeout(() => petEl.classList.remove("happy"), 500);
  });

  // Right click / long press open panel
  petEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openPanel();
  });

  // Double click also open
  petEl.addEventListener("dblclick", openPanel);

  // Panel
  document.getElementById("close-panel").onclick = closePanel;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.add("hidden"));
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");
    };
  });

  // Chat
  sendBtn.onclick = () => sendChat(chatInput.value);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat(chatInput.value);
  });
  quickInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      sendChat(quickInput.value);
      quickInput.value = "";
    }
  });

  // Settings
  document.getElementById("auto-act").onchange = (e) => {
    if (e.target.checked) startAutoBehavior();
    else stopAutoBehavior();
  };
  document.getElementById("reset-pet").onclick = () => {
    state = { ...DEFAULT_STATE, x: state.x, y: state.y };
    applyAppearance();
    buildOptionGrids();
    saveState();
    toast("外观已重置");
  };
  document.getElementById("fixed-pos").onchange = (e) => {
    if (e.target.checked) {
      petEl.style.left = "20px";
      petEl.style.top = "20px";
      state.x = 20;
      state.y = 20;
      saveState();
    }
  };

  // Close panel on outside click
  document.addEventListener("click", (e) => {
    if (!panelEl.classList.contains("hidden") && !panelEl.contains(e.target) && !petEl.contains(e.target)) {
      closePanel();
    }
  });
}

function openPanel() {
  panelEl.classList.remove("hidden");
}
function closePanel() {
  panelEl.classList.add("hidden");
}

// ========== Bubble ==========
function showBubble(text, duration = 4000) {
  bubbleEl.textContent = text;
  bubbleEl.classList.remove("hidden");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubbleEl.classList.add("hidden"), duration);
}

// ========== Auto behavior ==========
function startAutoBehavior() {
  stopAutoBehavior();
  autoTimer = setInterval(() => {
    if (!document.getElementById("auto-act").checked) return;
    const actions = ["speak", "happy", "change"];
    const act = actions[Math.floor(Math.random() * actions.length)];
    if (act === "speak") {
      const lines = [
        "今天也要加油哦～",
        "摸摸我嘛～",
        "有点想睡觉了…",
        "主人在忙什么呀？",
        "换个发型好不好？",
        "饿了吗？我也想吃零食～",
        "天气真好呢！",
        "记得休息眼睛哦～",
      ];
      showBubble(lines[Math.floor(Math.random() * lines.length)]);
      petEl.classList.add("happy");
      setTimeout(() => petEl.classList.remove("happy"), 600);
    } else if (act === "happy") {
      petEl.classList.add("happy");
      setTimeout(() => petEl.classList.remove("happy"), 600);
    } else if (act === "change" && document.getElementById("auto-change").checked) {
      // random small change
      const parts = ["eyes", "mouth", "accessory"];
      const part = parts[Math.floor(Math.random() * parts.length)];
      const opts = OPTIONS[part];
      const next = opts[Math.floor(Math.random() * opts.length)].id;
      setPart(part, next);
      showBubble("我换了个样子哦～ 好看吗？", 2500);
    }
  }, 45000 + Math.random() * 30000); // 45-75s
}

function stopAutoBehavior() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}

// ========== Chat ==========
function addChatMsg(role, text) {
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.textContent = text;
  chatLog.appendChild(div);
  chatLog.scrollTop = chatLog.scrollHeight;
}

async function sendChat(text) {
  text = (text || "").trim();
  if (!text) return;

  chatInput.value = "";
  addChatMsg("user", text);
  chatHistory.push({ role: "user", content: text });

  sendBtn.disabled = true;
  petEl.classList.add("thinking");
  showBubble("思考中…", 10000);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chatHistory,
        petState: {
          eyes: state.eyes,
          mouth: state.mouth,
          hair: state.hair,
          top: state.top,
          accessory: state.accessory,
        },
      }),
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const reply = data.reply || "喵？";
    addChatMsg("ai", reply);
    chatHistory.push({ role: "assistant", content: reply });
    showBubble(reply, 6000);

    // Apply AI-suggested changes
    if (data.changes && Object.keys(data.changes).length) {
      Object.entries(data.changes).forEach(([k, v]) => {
        if (OPTIONS[k] && OPTIONS[k].some((o) => o.id === v)) {
          setPart(k, v);
        }
      });
      toast("小云换了新样子～");
    }
  } catch (err) {
    console.error(err);
    const fallback = "呜… 网络好像有点问题，但我还在这里陪你哦～";
    addChatMsg("ai", fallback);
    showBubble(fallback, 4000);
  } finally {
    sendBtn.disabled = false;
    petEl.classList.remove("thinking");
  }
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2500);
}

// Start
init();