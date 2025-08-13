const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3001;
const BASE_URL = process.env.CHATHUB_BASE_URL || "https://app.chathub.gg";
const API_PATH = process.env.CHATHUB_API_PATH || "/api/chat";
const AUTH_COOKIE = process.env.CHATHUB_AUTH_COOKIE || "";
const AUTH_HEADER = process.env.CHATHUB_AUTH_HEADER || "";
const EXTRA_HEADERS = safeJson(process.env.CHATHUB_EXTRA_HEADERS) || {};
const DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL || "gpt-3.5-turbo";

function safeJson(s) {
  try {
    if (!s) return null;
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function openaiToChatHubPayload(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const model = body?.model || DEFAULT_MODEL;
  const payload = { messages, model };
  if (typeof body?.temperature === "number") payload.temperature = body.temperature;
  if (typeof body?.top_p === "number") payload.top_p = body.top_p;
  if (typeof body?.max_tokens === "number") payload.max_tokens = body.max_tokens;
  return payload;
}

function headersForChatHub() {
  const headers = {
    "content-type": "application/json",
    ...EXTRA_HEADERS
  };
  if (AUTH_COOKIE) headers["cookie"] = AUTH_COOKIE;
  if (AUTH_HEADER) {
    const [k, v] = AUTH_HEADER.split(":");
    if (k && v) headers[k.trim()] = v.trim();
  }
  return headers;
}

function chathubToOpenAIResponse(ch) {
  const content =
    ch?.content ||
    ch?.message?.content ||
    ch?.data?.content ||
    ch?.text ||
    "";
  const role =
    ch?.role ||
    ch?.message?.role ||
    "assistant";
  const usage = ch?.usage || null;
  return {
    id: "chatcmpl_" + Math.random().toString(36).slice(2),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: ch?.model || DEFAULT_MODEL,
    choices: [
      {
        index: 0,
        message: {
          role,
          content: typeof content === "string" ? content : JSON.stringify(content)
        },
        finish_reason: ch?.finish_reason || "stop"
      }
    ],
    usage: usage || undefined
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, baseUrl: BASE_URL, apiPath: API_PATH });
});

app.get("/config", (_req, res) => {
  res.json({
    baseUrl: BASE_URL,
    apiPath: API_PATH,
    hasAuthCookie: !!AUTH_COOKIE,
    hasAuthHeader: !!AUTH_HEADER
  });
});

app.get("/v1/models", (_req, res) => {
  res.json({
    object: "list",
    data: [
      {
        id: DEFAULT_MODEL,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: "chathub"
      }
    ]
  });
});

app.post("/v1/completions", async (req, res) => {
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt : "";
    const model = req.body?.model || DEFAULT_MODEL;
    const payload = { model, messages: [{ role: "user", content: prompt }] };
    const url = new URL(API_PATH, BASE_URL).toString();
    const resp = await axios.post(url, payload, {
      headers: headersForChatHub(),
      validateStatus: () => true,
      timeout: 60000
    });
    if (req.body?.stream) {
      res.status(400).json({ error: { message: "stream=true not supported yet" } });
      return;
    }
    if (resp.status >= 200 && resp.status < 300) {
      const data = resp.data;
      const mapped = chathubToOpenAIResponse(data);
      const text = mapped?.choices?.[0]?.message?.content || "";
      res.json({
        id: mapped.id,
        object: "text_completion",
        created: mapped.created,
        model: mapped.model,
        choices: [
          {
            index: 0,
            text,
            logprobs: null,
            finish_reason: mapped?.choices?.[0]?.finish_reason || "stop"
          }
        ]
      });
    } else {
      res.status(resp.status).json({
        error: {
          message: "Upstream error",
          status: resp.status,
          data: resp.data
        }
      });
    }
  } catch (e) {
    res.status(500).json({
      error: {
        message: "Proxy error",
        detail: String(e?.message || e)
      }
    });
  }
});

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const payload = openaiToChatHubPayload(req.body || {});
    const url = new URL(API_PATH, BASE_URL).toString();
    const resp = await axios.post(url, payload, {
      headers: headersForChatHub(),
      validateStatus: () => true,
      timeout: 60000
    });
    if (req.body?.stream) {
      res.status(400).json({ error: { message: "stream=true not supported yet" } });
      return;
    }
    if (resp.status >= 200 && resp.status < 300) {
      const data = resp.data;
      const mapped = chathubToOpenAIResponse(data);
      res.json(mapped);
    } else {
      res.status(resp.status).json({
        error: {
          message: "Upstream error",
          status: resp.status,
          data: resp.data
        }
      });
    }
  } catch (e) {
    res.status(500).json({
      error: {
        message: "Proxy error",
        detail: String(e?.message || e)
      }
    });
  }
});

app.listen(PORT, () => {
  console.log("ChatHub OpenAI proxy listening on", PORT);
});
