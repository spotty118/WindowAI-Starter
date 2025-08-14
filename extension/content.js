const STORAGE_ENABLED = "chi_enabled";
const MSG_FROM_INJECT = "CHI_FROM_INJECT";
const MSG_TO_BACKGROUND = "CHI_TO_BG";
const MSG_BG_BROADCAST = "CHI_BG_BROADCAST";

function injectPageScript() {
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("inject.js");
  s.async = false;
  (document.documentElement || document.head || document.body).appendChild(s);
  s.onload = () => s.remove();
}

function postToBackground(payload) {
  chrome.runtime.sendMessage({ type: MSG_TO_BACKGROUND, payload }).catch(() => {});
}

function forwardEnabledToPage(enabled) {
  window.postMessage({ source: "CHI_CS", type: "CHI_SET_ENABLED", enabled }, location.origin);
}

window.addEventListener("message", (event) => {
  try {
    if (event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.source !== MSG_FROM_INJECT) return;
    postToBackground(data);
  } catch {}
});

(async () => {
  injectPageScript();
  const v = await chrome.storage.local.get(STORAGE_ENABLED);
  const enabled = typeof v[STORAGE_ENABLED] === "undefined" ? true : !!v[STORAGE_ENABLED];
  forwardEnabledToPage(enabled);
})();

chrome.runtime.onMessage.addListener((msg) => {
  try {
    if (msg && msg.type === MSG_BG_BROADCAST && msg.payload && "enabled" in msg.payload) {
      forwardEnabledToPage(!!msg.payload.enabled);
    }
  } catch {}
});
