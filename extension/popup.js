 
const STORAGE_ENABLED = "chi_enabled";
const STORAGE_LOGS = "chi_logs";
const MSG_TOGGLE = "CHI_TOGGLE";
const MSG_CLEAR = "CHI_CLEAR";
const MSG_GET_STATE = "CHI_GET_STATE";
const MSG_GET_COOKIES = "CHI_GET_COOKIES";
const MSG_BG_BROADCAST = "CHI_BG_BROADCAST";

const enabledToggle = document.getElementById("enabledToggle");
const clearBtn = document.getElementById("clearBtn");
const exportBtn = document.getElementById("exportBtn");
const filterSel = document.getElementById("filter");
const searchInp = document.getElementById("search");
const cookiesBtn = document.getElementById("cookiesBtn");
const cookiesBox = document.getElementById("cookiesBox");
const cookieHeaderBox = document.getElementById("cookieHeaderBox");
const copyCookieHeaderBtn = document.getElementById("copyCookieHeaderBtn");
const exportCookiesBtn = document.getElementById("exportCookiesBtn");
const logsEl = document.getElementById("logs");

let cookieHeader = "";
let cookiesArr = [];
let state = { enabled: true, logs: [] };

function apiTag(api) {
  const el = document.createElement("span");
  el.className = "tag " + api;
  el.textContent = api;
  return el;
}

function formatEntry(e) {
  const container = document.createElement("div");
  container.className = "entry";
  const meta = document.createElement("div");
  meta.className = "meta";
  const left = document.createElement("div");
  const right = document.createElement("div");
  const time = new Date(e.ts || Date.now()).toLocaleTimeString();
  left.appendChild(apiTag(e.api));
  const url = document.createElement("span");
  url.className = "url";
  url.textContent = " " + (e.url || "");
  left.appendChild(url);
  right.textContent = (e.phase || "") + " • " + time;
  meta.appendChild(left);
  meta.appendChild(right);
  container.appendChild(meta);

  const details = document.createElement("div");
  details.className = "details";
  const trimmed = {
    method: e.method,
    status: e.status,
    statusText: e.statusText,
    headers: e.headers,
    requestHeaders: e.requestHeaders,
    body: e.body,
    page: e.page,
    error: e.error
  };
  details.textContent = JSON.stringify(trimmed, null, 2);
  container.appendChild(details);
  return container;
}

function render() {
  const f = filterSel.value;
  const q = (searchInp.value || "").toLowerCase();
  logsEl.innerHTML = "";
  let list = state.logs;
  if (f !== "all") list = list.filter(x => x.api === f);
  if (q) list = list.filter(x => (x.url || "").toLowerCase().includes(q));
  for (let i = list.length - 1; i >= 0; i--) {
    logsEl.appendChild(formatEntry(list[i]));
  }
}

chrome.runtime.sendMessage({ type: MSG_GET_STATE }, (res) => {
  try {
    if (res && res.ok) {
      state.enabled = !!res.enabled;
      state.logs = Array.isArray(res.logs) ? res.logs : [];
      enabledToggle.checked = state.enabled;
      render();
    }
  } catch {}
});

enabledToggle.addEventListener("change", () => {
  const val = !!enabledToggle.checked;
  chrome.runtime.sendMessage({ type: MSG_TOGGLE, enabled: val }, () => {});
});

clearBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: MSG_CLEAR }, () => {
    state.logs = [];
    render();
  });
});

exportBtn.addEventListener("click", async () => {
  try {
    const v = await chrome.storage.local.get(STORAGE_LOGS);
    const data = Array.isArray(v[STORAGE_LOGS]) ? v[STORAGE_LOGS] : [];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chathub-logs.json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1000);
  } catch {}
});

filterSel.addEventListener("change", render);
searchInp.addEventListener("input", render);

chrome.runtime.onMessage.addListener((msg) => {
  try {
    if (msg && msg.type === MSG_BG_BROADCAST) {
      if (msg.payload && msg.payload.newEntry) {
        state.logs.push(msg.payload.newEntry);
        render();
      }
      if (msg.payload && "enabled" in msg.payload) {
        state.enabled = !!msg.payload.enabled;
        enabledToggle.checked = state.enabled;
      }
    }
  } catch {}
});
cookiesBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: MSG_GET_COOKIES }, (res) => {
    if (res && res.ok) {
      cookieHeader = res.header || "";
      cookiesArr = Array.isArray(res.cookies) ? res.cookies : [];
      cookiesBox.style.display = "block";
      cookieHeaderBox.textContent = cookieHeader || "(no cookies found)";
    } else {
      cookiesBox.style.display = "block";
      cookieHeaderBox.textContent = "Failed to fetch cookies";
    }
  });
});
copyCookieHeaderBtn.addEventListener("click", () => {
  if (!cookieHeader) return;
  navigator.clipboard.writeText(cookieHeader);
});
exportCookiesBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(cookiesArr, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chathub-cookies.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
