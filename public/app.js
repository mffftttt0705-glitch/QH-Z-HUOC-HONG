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
  addChatMsg("system", "小云已上线～ 拖我移动，双击打开面板");
  showBubble("你好呀主人～ ☁️", 3000);
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
  } else {
    petEl.style.right = "20px";
    petEl.style.bottom = "100px";
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
  petEl.classList.add("happy");
  setTimeout(() => petEl.classList.remove("happy"), 500);
}

function setBg(name) {
  state.bg = name;
  applyBg();
  saveState();
}

function bindEvents() {
  petEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    petEl.setPointerCapture(e.pointerId);
    const rect = petEl.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    // 清除 right/bottom，改用 left/top
    petEl.style.right = "auto";
    petEl.style.bottom = "auto";
    petEl.style.left = rect.left + "px";
    petEl.style.top = rect.top + "px";
    e.preventDefault();
  });

  petEl.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const x = Math.max(0, Math.min(window.innerWidth - petEl.offsetWidth, e.clientX - dragOffset.x));
    const y = Math.max(0, Math.min(window.innerHeight - petEl.offsetHeight, e.clientY - dragOffset.y));
    petEl.style.left = x + "px";
    petEl.style.top = y + "px";
  });

  petEl.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    try { petEl.releasePointerCapture(e.pointerId); } catch {}
    state.x = parseInt(petEl.style.left) || 0;
    state.y = parseInt(petEl.style.top) || 0;
    saveState();
    petEl.classList.add("happy");
    setTimeout(() => petEl.classList.remove("happy"), 400);
  });

  petEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    openPanel();
  });
  petEl.addEventListener("dblclick", openPanel);

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
    petEl.style.right = "20px";
    petEl.style.bottom = "100px";
    saveState();
    toast("位置已重置");
  };

  document.addEventListener("click", (e) => {
    if (!panelEl.classList.contains("hidden") && !panelEl.contains(e.target) && !petEl.contains(e.target)) {
      closePanel();
    }
  });
}

function openPanel() { panelEl.classList.remove("hidden"); }
function closePanel() { panelEl.classList.add("hidden"); }

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
    ];
    showBubble(lines[Math.floor(Math.random() * lines.length)]);
    petEl.classList.add("happy");
    setTimeout(() => petEl.classList.remove("happy"), 500);
  }, 50000 + Math.random() * 25000);
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
  petEl.classList.add("thinking");
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
      return;
    }

    const reply = data.reply || "嗯？";
    addChatMsg("ai", reply);
    chatHistory.push({ role: "assistant", content: reply });
    showBubble(reply, 6000);

    if (data.changes?.outfit && OUTFITS[data.changes.outfit]) {
      setOutfit(data.changes.outfit);
      toast("小云换装啦～");
    }
  } catch (err) {
    console.error(err);
    const msg = "网络请求失败，请检查是否已部署 functions/api/chat.js";
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