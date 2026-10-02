const OUTFITS = {
  school: "/xiaoyun-school.png",
  hoodie: "/xiaoyun-hoodie.png",
  kimono: "/xiaoyun-kimono.png",
};

const DEFAULT_STATE = {
  outfit: "school",
  bg: "default",
  x: null,
  y: null,
};

let state = loadState();
let chatHistory = [];
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let autoTimer = null;
let bubbleTimer = null;
let animTimer = null;

const petEl = document.getElementById("pet");
const petImg = document.getElementById("pet-img");
const bubbleEl = document.getElementById("bubble");
const panelEl = document.getElementById("panel");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const quickInput = document.getElementById("quick-input");
const sendBtn = document.getElementById("send-btn");
const quickChat = document.getElementById("quick-chat");

function init() {
  applyOutfit();
  applyBg();
  positionPet();
  bindEvents();
  startAutoBehavior();
  startIdleAnim();
  addChatMsg("system", "小云已上线～ 拖我移动，双击打开面板");
  showBubble("你好呀主人～ ☁️", 3000);
  playAnim("wave");
}

function loadState() {
  try {
    const raw = localStorage.getItem("xiaoyun-pet-state");
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_STATE };
}

function saveState() {
  localStorage.setItem("xiaoyun-pet-state", JSON.stringify(state));
}

function positionPet() {
  if (state.x != null && state.y != null) {
    petEl.style.left = state.x + "px";
    petEl.style.top = state.y + "px";
    petEl.style.right = "auto";
    petEl.style.bottom = "auto";
  } else {
    petEl.style.right = "16px";
    petEl.style.bottom = "max(100px, env(safe-area-inset-bottom, 0px) + 80px)";
    petEl.style.left = "auto";
    petEl.style.top = "auto";
  }
}

function applyOutfit() {
  const src = OUTFITS[state.outfit] || OUTFITS.school;
  petImg.src = src;
  document.querySelectorAll(".outfit-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.outfit === state.outfit);
  });
}

function applyBg() {
  document.body.className = "bg-" + (state.bg || "default");
  document.querySelectorAll(".bg-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.bg === state.bg);
  });
}

function setOutfit(name) {
  if (!OUTFITS[name]) return;
  state.outfit = name;
  applyOutfit();
  saveState();
  playAnim("spin");
}

function setBg(name) {
  state.bg = name;
  applyBg();
  saveState();
}

/** 播放 2D 动作：bounce / sway / wave / jump / spin / idle / happy / thinking */
function playAnim(name, duration = 800) {
  const classes = ["happy", "thinking", "wave", "jump", "spin", "bounce-strong"];
  classes.forEach((c) => petEl.classList.remove(c));
  clearTimeout(animTimer);
  if (name === "idle") return;
  petEl.classList.add(name === "happy" ? "happy" : name);
  animTimer = setTimeout(() => {
    petEl.classList.remove(name === "happy" ? "happy" : name);
  }, duration);
}

function startIdleAnim() {
  // 轻微呼吸由 CSS 持续，无需 JS
}

function bindEvents() {
  // 拖动：支持鼠标 + 触摸
  petEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    isDragging = true;
    petEl.setPointerCapture(e.pointerId);
    const rect = petEl.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    petEl.style.right = "auto";
    petEl.style.bottom = "auto";
    petEl.style.left = rect.left + "px";
    petEl.style.top = rect.top + "px";
    petEl.classList.add("dragging");
    e.preventDefault();
  });

  petEl.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const maxX = window.innerWidth - petEl.offsetWidth;
    const maxY = window.innerHeight - petEl.offsetHeight;
    const x = Math.max(0, Math.min(maxX, e.clientX - dragOffset.x));
    const y = Math.max(0, Math.min(maxY, e.clientY - dragOffset.y));
    petEl.style.left = x + "px";
    petEl.style.top = y + "px";
  });

  petEl.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    petEl.classList.remove("dragging");
    try { petEl.releasePointerCapture(e.pointerId); } catch {}
    state.x = parseInt(petEl.style.left, 10) || 0;
    state.y = parseInt(petEl.style.top, 10) || 0;
    saveState();
    playAnim("happy", 500);
  });

  petEl.addEventListener("pointercancel", () => {
    isDragging = false;
    petEl.classList.remove("dragging");
  });

  petEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openPanel();
  });
  petEl.addEventListener("dblclick", openPanel);

  // 单击也可打开（移动端双击不便）——短按未拖动则打开
  let tapStart = 0;
  let tapMoved = false;
  petEl.addEventListener("pointerdown", () => {
    tapStart = Date.now();
    tapMoved = false;
  });
  petEl.addEventListener("pointermove", () => { tapMoved = true; });
  petEl.addEventListener("pointerup", () => {
    if (!tapMoved && Date.now() - tapStart < 250) {
      // 轻点：随机动作 + 可选打开面板（长按/双击更稳）
      const acts = ["wave", "jump", "happy"];
      playAnim(acts[Math.floor(Math.random() * acts.length)], 700);
    }
  });

  document.getElementById("close-panel").onclick = closePanel;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.onclick = () => {
      document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".tab-content").forEach((c) => c.classList.add("hidden"));
      document.getElementById("tab-" + tab.dataset.tab).classList.remove("hidden");
    };
  });

  document.querySelectorAll(".outfit-btn").forEach((btn) => {
    btn.onclick = () => setOutfit(btn.dataset.outfit);
  });
  document.querySelectorAll(".bg-btn").forEach((btn) => {
    btn.onclick = () => setBg(btn.dataset.bg);
  });

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

  document.getElementById("auto-act").onchange = (e) => {
    if (e.target.checked) startAutoBehavior();
    else stopAutoBehavior();
  };
  document.getElementById("hide-quick").onchange = (e) => {
    quickChat.classList.toggle("hidden", e.target.checked);
  };
  document.getElementById("reset-pos").onclick = () => {
    state.x = null;
    state.y = null;
    petEl.style.left = "auto";
    petEl.style.top = "auto";
    petEl.style.right = "16px";
    petEl.style.bottom = "max(100px, env(safe-area-inset-bottom, 0px) + 80px)";
    saveState();
    toast("位置已重置");
  };

  document.addEventListener("click", (e) => {
    if (!panelEl.classList.contains("hidden") && !panelEl.contains(e.target) && !petEl.contains(e.target)) {
      closePanel();
    }
  });

  // 窗口变化时限制位置
  window.addEventListener("resize", () => {
    if (state.x == null) return;
    const maxX = window.innerWidth - petEl.offsetWidth;
    const maxY = window.innerHeight - petEl.offsetHeight;
    state.x = Math.max(0, Math.min(maxX, state.x));
    state.y = Math.max(0, Math.min(maxY, state.y));
    petEl.style.left = state.x + "px";
    petEl.style.top = state.y + "px";
    saveState();
  });
}

function openPanel() {
  panelEl.classList.remove("hidden");
  playAnim("wave", 600);
}
function closePanel() {
  panelEl.classList.add("hidden");
}

function showBubble(text, duration = 4500) {
  bubbleEl.textContent = text;
  bubbleEl.classList.remove("hidden");
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubbleEl.classList.add("hidden"), duration);
}

function startAutoBehavior() {
  stopAutoBehavior();
  autoTimer = setInterval(() => {
    if (!document.getElementById("auto-act").checked) return;
    const lines = [
      "今天也要加油哦～",
      "摸摸我嘛～",
      "要不要换套衣服？",
      "主人在忙什么呀？",
      "记得休息一下～",
      "我在这里陪你哦",
      "点我可以拖动哦～",
    ];
    showBubble(lines[Math.floor(Math.random() * lines.length)]);
    const acts = ["wave", "jump", "happy", "spin"];
    playAnim(acts[Math.floor(Math.random() * acts.length)], 900);
  }, 45000 + Math.random() * 30000);
}

function stopAutoBehavior() {
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = null;
}

function addChatMsg(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
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
  playAnim("thinking", 15000);
  showBubble("思考中…", 12000);

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: chatHistory,
        petState: { outfit: state.outfit },
      }),
    });

    const data = await res.json();

    if (data.error) {
      addChatMsg("ai", data.error);
      showBubble(data.error, 8000);
      playAnim("happy", 400);
      return;
    }

    const reply = data.reply || "嗯？";
    addChatMsg("ai", reply);
    chatHistory.push({ role: "assistant", content: reply });
    showBubble(reply, 6000);
    playAnim("wave", 800);

    if (data.changes?.outfit && OUTFITS[data.changes.outfit]) {
      setOutfit(data.changes.outfit);
      toast("小云换装啦～");
    }
  } catch (err) {
    console.error(err);
    const msg = "网络请求失败，请确认已部署 functions/api/chat.js 并绑定 Workers AI";
    addChatMsg("ai", msg);
    showBubble(msg, 6000);
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

init();
