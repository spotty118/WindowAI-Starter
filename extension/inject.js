(() => {
  let enabled = true;
  function setEnabled(v) {
    enabled = !!v;
  }
  window.addEventListener("message", (e) => {
    try {
      if (e.origin !== location.origin) return;
      const d = e.data;
      if (!d || d.type !== "CHI_SET_ENABLED") return;
      setEnabled(!!d.enabled);
    } catch {}
  });

  const SOURCE = "CHI_FROM_INJECT";
  const MAX_BODY = 64 * 1024;

  function safeHeadersToObj(headers) {
    const obj = {};
    try {
      headers.forEach((v, k) => {
        obj[k] = v;
      });
    } catch {}
    return obj;
  }

  async function safeReadBody(src, headers) {
    try {
      if (!src) return null;
      const contentType = headers && typeof headers.get === "function" ? headers.get("content-type") : null;

      if (typeof src.arrayBuffer === "function") {
        const buf = await src.arrayBuffer();
        const slice = buf.byteLength > MAX_BODY ? buf.slice(0, MAX_BODY) : buf;
        const text = new TextDecoder("utf-8", { fatal: false }).decode(slice);
        if (contentType && /application\/json/i.test(contentType)) {
          try {
            return { text, json: JSON.parse(text), truncated: buf.byteLength > MAX_BODY };
          } catch {
            return { text, truncated: buf.byteLength > MAX_BODY };
          }
        }
        return { text, truncated: buf.byteLength > MAX_BODY };
      }

      if (typeof src.text === "function") {
        const textFull = await src.text();
        const truncated = textFull.length > MAX_BODY;
        const text = truncated ? textFull.slice(0, MAX_BODY) : textFull;
        if (contentType && /application\/json/i.test(contentType)) {
          try {
            return { text, json: JSON.parse(text), truncated };
          } catch {
            return { text, truncated };
          }
        }
        return { text, truncated };
      }

      if (src && typeof src.getReader === "function") {
        return { text: "[stream]", truncated: false };
      }

      return null;
    } catch {
      return null;
    }
  }

  function post(payload) {
    try {
      window.postMessage({ source: SOURCE, ...payload }, location.origin);
    } catch {}
  }

  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    if (!enabled) return _fetch.apply(this, arguments);
    try {
      const req = new Request(input, init);
      const reqClone = req.clone();
      const reqHeaders = safeHeadersToObj(reqClone.headers);
      const reqBody = await safeReadBody(reqClone, { get: () => reqHeaders["content-type"] || null });
      post({
        api: "fetch",
        phase: "request",
        url: req.url,
        method: req.method,
        headers: reqHeaders,
        body: reqBody,
        page: location.href
      });
      const res = await _fetch(req);
      const resClone = res.clone();
      const resHeaders = safeHeadersToObj(resClone.headers);
      let resBody = null;
      try {
        resBody = await safeReadBody(resClone, resClone.headers);
      } catch {}
      post({
        api: "fetch",
        phase: "response",
        url: req.url,
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: resBody,
        page: location.href
      });
      return res;
    } catch (e) {
      post({
        api: "fetch",
        phase: "error",
        error: String(e),
        page: location.href
      });
      throw e;
    }
  };

  const _XHR = window.XMLHttpRequest;
  function XHRProxy() {
    const xhr = new _XHR();
    let meta = { method: null, url: null, async: true, reqHeaders: {}, reqBody: null };
    const open = xhr.open;
    xhr.open = function(method, url, async, user, password) {
      meta.method = method;
      meta.url = url;
      meta.async = async !== false;
      return open.apply(xhr, arguments);
    };
    const setRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function(k, v) {
      meta.reqHeaders[k] = v;
      return setRequestHeader.apply(xhr, arguments);
    };
    const send = xhr.send;
    xhr.send = function(body) {
      if (enabled) {
        meta.reqBody = typeof body === "string" ? (body.length > MAX_BODY ? body.slice(0, MAX_BODY) : body) : body;
        post({
          api: "xhr",
          phase: "request",
          url: meta.url,
          method: meta.method,
          headers: meta.reqHeaders,
          body: typeof meta.reqBody === "string" ? { text: meta.reqBody, truncated: (body || "").length > MAX_BODY } : null,
          page: location.href
        });
      }
      xhr.addEventListener("loadend", () => {
        if (!enabled) return;
        let headersStr = "";
        try { headersStr = xhr.getAllResponseHeaders() || ""; } catch {}
        const headersObj = {};
        headersStr.trim().split(/[\r\n]+/).forEach(line => {
          const parts = line.split(": ");
          const key = parts.shift();
          if (key) headersObj[key.toLowerCase()] = parts.join(": ");
        });
        let bodyText = null;
        try { bodyText = xhr.responseText || ""; } catch { bodyText = null; }
        const truncated = bodyText && bodyText.length > MAX_BODY;
        const body = bodyText ? { text: truncated ? bodyText.slice(0, MAX_BODY) : bodyText, truncated } : null;
        post({
          api: "xhr",
          phase: "response",
          url: meta.url,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headersObj,
          body,
          page: location.href
        });
      });
      return send.apply(xhr, arguments);
    };
    return xhr;
  }
  window.XMLHttpRequest = XHRProxy;

  const _WS = window.WebSocket;
  window.WebSocket = function(url, protocols) {
    const ws = new _WS(url, protocols);
    try {
      ws.addEventListener("open", () => {
        if (enabled) post({ api: "ws", phase: "open", url: url, page: location.href });
      });
      ws.addEventListener("message", (ev) => {
        if (!enabled) return;
        let data = ev.data;
        if (typeof data !== "string") data = "[binary]";
        const truncated = typeof data === "string" && data.length > MAX_BODY;
        post({
          api: "ws",
          phase: "message",
          url: url,
          body: { text: truncated ? data.slice(0, MAX_BODY) : data, truncated: !!truncated },
          page: location.href
        });
      });
      const send = ws.send;
      ws.send = function(d) {
        if (enabled) {
          let data = d;
          if (typeof data !== "string") data = "[binary]";
          const truncated = typeof data === "string" && data.length > MAX_BODY;
          post({
            api: "ws",
            phase: "send",
            url: url,
            body: { text: truncated ? data.slice(0, MAX_BODY) : data, truncated: !!truncated },
            page: location.href
          });
        }
        return send.apply(ws, arguments);
      };
      ws.addEventListener("close", (ev) => {
        if (enabled) post({ api: "ws", phase: "close", url: url, code: ev.code, reason: ev.reason, page: location.href });
      });
      ws.addEventListener("error", () => {
        if (enabled) post({ api: "ws", phase: "error", url: url, page: location.href });
      });
    } catch {}
    return ws;
  };

  const _ES = window.EventSource;
  window.EventSource = function(url, config) {
    const es = new _ES(url, config);
    try {
      es.addEventListener("open", () => {
        if (enabled) post({ api: "sse", phase: "open", url: url, page: location.href });
      });
      es.addEventListener("message", (ev) => {
        if (!enabled) return;
        const data = ev.data || "";
        const truncated = data.length > MAX_BODY;
        post({
          api: "sse",
          phase: "message",
          url: url,
          body: { text: truncated ? data.slice(0, MAX_BODY) : data, truncated },
          page: location.href
        });
      });
      es.addEventListener("error", () => {
        if (enabled) post({ api: "sse", phase: "error", url: url, page: location.href });
      });
    } catch {}
    return es;
  };
})();
