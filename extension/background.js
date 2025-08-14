 
const STORAGE_ENABLED = "chi_enabled";
const STORAGE_LOGS = "chi_logs";
const MSG_TO_BACKGROUND = "CHI_TO_BG";
const MSG_TOGGLE = "CHI_TOGGLE";
const MSG_CLEAR = "CHI_CLEAR";
const MSG_GET_STATE = "CHI_GET_STATE";
const MSG_GET_COOKIES = "CHI_GET_COOKIES";
const MSG_BG_BROADCAST = "CHI_BG_BROADCAST";
const MAX_LOGS = 1000;

async function getEnabled() {
  const v = await chrome.storage.local.get(STORAGE_ENABLED);
  if (typeof v[STORAGE_ENABLED] === "undefined") return true;
  return !!v[STORAGE_ENABLED];
}

async function setEnabled(val) {
  await chrome.storage.local.set({ [STORAGE_ENABLED]: !!val });
  chrome.runtime.sendMessage({ type: MSG_BG_BROADCAST, payload: { enabled: !!val } }).catch(() => {});
}

async function getLogs() {
  const v = await chrome.storage.local.get(STORAGE_LOGS);
  return Array.isArray(v[STORAGE_LOGS]) ? v[STORAGE_LOGS] : [];
}

async function setLogs(logs) {
  await chrome.storage.local.set({ [STORAGE_LOGS]: logs });
}

chrome.runtime.onInstalled.addListener(async () => {
  const v = await chrome.storage.local.get([STORAGE_ENABLED, STORAGE_LOGS]);
  if (typeof v[STORAGE_ENABLED] === "undefined") {
    await chrome.storage.local.set({ [STORAGE_ENABLED]: true });
  }
  if (!Array.isArray(v[STORAGE_LOGS])) {
    await chrome.storage.local.set({ [STORAGE_LOGS]: [] });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === MSG_TO_BACKGROUND) {
      const enabled = await getEnabled();
      if (!enabled) {
        sendResponse({ ok: true, ignored: true });
        return;
      }
      const logs = await getLogs();
      const entry = { id: crypto.randomUUID(), ts: Date.now(), ...msg.payload };
      logs.push(entry);
      while (logs.length > MAX_LOGS) logs.shift();
      await setLogs(logs);
      chrome.runtime.sendMessage({ type: MSG_BG_BROADCAST, payload: { newEntry: entry } }).catch(() => {});
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === MSG_TOGGLE) {
      await setEnabled(!!msg.enabled);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === MSG_CLEAR) {
      await setLogs([]);
      sendResponse({ ok: true });
      return;
    }
    if (msg.type === MSG_GET_STATE) {
      const [enabled, logs] = await Promise.all([getEnabled(), getLogs()]);
      sendResponse({ ok: true, enabled, logs });
    if (msg.type === MSG_GET_COOKIES) {
      try {
        const cookies = await chrome.cookies.getAll({ domain: "chathub.gg" });
        const arr = Array.isArray(cookies) ? cookies : [];
        const header = arr
          .filter(c => !c.expirationDate || c.expirationDate * 1000 > Date.now())
          .map(c => `${c.name}=${c.value}`)
          .join("; ");
        sendResponse({
          ok: true,
          header,
          cookies: arr.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path,
            secure: c.secure,
            httpOnly: c.httpOnly,
            sameSite: c.sameSite,
            expirationDate: c.expirationDate
          }))
        });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
      return;
    }
      return;
    }
  })();
  return true;
});
