# WindowAI Starter

A minimalist, ready-to-use chat interface for the Window AI Chrome extension. Built with vanilla JavaScript, this starter template provides developers with the essential building blocks for creating AI chat applications.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🚀 Zero dependencies (except Window AI extension)
- 💡 Clean, responsive design
- ⚡ Lightweight and performant
- 🔧 Easy to customize and extend
- 📱 Mobile-friendly interface
- 🛠️ Simple integration with Window AI API
- 😀 Emojis and Typeback animation!
## Getting Started

### Clone the Repository

```bash
# Using HTTPS
git clone https://github.com/spotty118/WindowAI-Starter.git

# Using SSH
git clone git@github.com:spotty118/WindowAI-Starter.git

# Using GitHub CLI
gh repo clone spotty118/WindowAI-Starter
```

### Quick Setup
1. Clone the repository using one of the methods above
2. Open `index.html` in your browser
3. Make sure you have the Window AI extension installed
4. Start building your chat application!

## Prerequisites

- [Window AI Chrome Extension](https://chrome.google.com/webstore/detail/window-ai/cbhbgmdpcoelfdoihppookkijpmgahag) must be installed and enabled
- Modern web browser with JavaScript enabled

## Project Structure

```
├── index.html      # Basic HTML structure
├── style.css       # Responsive styling
└── script.js       # Core functionality
```

## Hosting Requirements

### Minimum VPS Requirements
- 1GB RAM
- 1 CPU Core
- 20GB Storage
- Ubuntu 20.04 or newer (recommended)

### Basic Server Setup

1. Install a web server (NGINX recommended)
2. Configure SSL certificate (recommended)
3. Set up proper file permissions
4. Configure domain settings

## How It Works

1. Install the Window AI Chrome extension
2. Configure your AI provider keys in the extension
3. Use this starter template to build your own AI chat application
4. The template handles all communication with your chosen AI model through the Window AI extension

## Development

The codebase is designed to be easily extensible. Key components:

- `addMessageToChat()`: Handles message display
- `waitForWindowAI()`: Manages extension availability
- `getAIResponse()`: Handles AI communication
- `handleMessage()`: Controls message flow

## Browser Support

- Chrome (recommended)
- Other modern browsers supporting Window AI extension

## Credits

This project is built on top of the [Window AI](https://github.com/alexanderatallah/window.ai) framework, which allows users to configure AI models in one place and use them across the web.

## Related Links

- [Window AI Extension](https://chrome.google.com/webstore/detail/window-ai/cbhbgmdpcoelfdoihppookkijpmgahag)
- [Window AI GitHub](https://github.com/alexanderatallah/window.ai)
- [Window AI Documentation](https://windowai.io)

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Window AI Extension team
- All contributors to this project
## Chrome Extension: ChatHub Interceptor

This repository now includes a simple Chrome Extension to intercept requests on app.chathub.gg for debugging.

Location:
- extension/manifest.json
- extension/background.js
- extension/content.js
- extension/inject.js
- extension/popup.html
- extension/popup.js
- extension/popup.css

How to load the extension:
1. Open Chrome and navigate to chrome://extensions/
2. Enable Developer mode (top-right toggle)
3. Click “Load unpacked” and select the extension/ folder in this repo
4. Ensure the extension is enabled

Usage:
- Navigate to https://app.chathub.gg/
- Complete login
- Click the extension icon to open the popup
- Use “Capture enabled” to toggle interception
- Use “Clear” to clear logs and “Export” to download JSON logs

What it captures:
- fetch and XHR requests and responses (URL, method/status, headers, body up to 64KB)
- WebSocket frames (text up to 64KB) and state changes
- Server-Sent Events (SSE) messages
All capture is scoped to https://app.chathub.gg/* and stored locally via chrome.storage.

Notes:
- This is logging-only and does not modify requests or the page.
- Bodies longer than 64KB are truncated for performance.
- The extension requires host permissions for https://app.chathub.gg/*
## OpenAI-Compatible Proxy Server

A minimal proxy is included to expose an OpenAI-compatible API backed by your authenticated ChatHub session.

Location:
- proxy-server/

Setup:
1. cd proxy-server
2. npm install
3. cp .env.example .env
4. Fill .env with your ChatHub auth and endpoint info:
   - CHATHUB_BASE_URL=https://app.chathub.gg
   - CHATHUB_API_PATH=/api/chat
   - CHATHUB_AUTH_COOKIE= Paste the Cookie header string for your ChatHub session
   - Or set CHATHUB_AUTH_HEADER=Authorization: Bearer YOUR_TOKEN if ChatHub uses an auth header
   - Optionally set CHATHUB_EXTRA_HEADERS to a JSON object for any additional headers required
5. npm start

Endpoints:
- POST /v1/chat/completions
  - Accepts standard OpenAI chat body: {"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello"}]}
  - Returns OpenAI-compatible JSON with choices[0].message.content
  - stream=true is not yet supported (non-streaming only)

How to retrieve auth:
- Load the Chrome extension in this repo and log in to https://app.chathub.gg
- In the popup, export logs and search for requests that include Authorization or Cookie headers
- Copy the Cookie header value into CHATHUB_AUTH_COOKIE, or an auth header into CHATHUB_AUTH_HEADER

Quick test:
curl -s http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"Hello from proxy"}]}'

Integration:
- Set your OpenAI-compatible client (e.g., Cline, Roo, etc.) to use http://localhost:3001 as the base URL.
- Use any model name; the proxy forwards model and messages to ChatHub.

Notes:
- Do not commit real cookies or tokens.
- The mapping to ChatHub is generic and may need tuned CHATHUB_API_PATH and headers based on the captured requests.
- If ChatHub uses streaming via SSE or WebSockets, add streaming support later as needed.
### Notes on Cookies and Headers

- Modern browsers do not expose httpOnly cookies to JavaScript. The extension’s fetch/XHR wrappers cannot read the Cookie header that the browser attaches automatically.
- If ChatHub uses session cookies, retrieve them via Chrome DevTools:
  1) Open https://app.chathub.gg
  2) Open DevTools → Application → Cookies → https://app.chathub.gg
  3) Copy the relevant session cookie(s) and place them into CHATHUB_AUTH_COOKIE in the proxy .env as a Cookie header string (e.g., session=...; other=...).
- If ChatHub uses an Authorization bearer or custom header set by client JS, the extension logs will likely include it in request headers; you can use that value for CHATHUB_AUTH_HEADER instead.
### Additional OpenAI-compatible endpoints

- GET /v1/models
  - Returns a single model entry based on OPENAI_DEFAULT_MODEL (or the model you configure).
- POST /v1/completions
  - Legacy completions API. Accepts {"model": "...", "prompt": "..."}. Internally mapped to ChatHub with a single user message.
### Cookie retrieval via extension (optional)

- The extension now includes a "Show Cookies" button in the popup. It reads cookies for chathub.gg (requires cookies permission) and renders a ready-to-paste Cookie header.
- Click "Copy Cookie header" to copy and paste into CHATHUB_AUTH_COOKIE in proxy-server/.env.
- You can also "Export cookies JSON" for debugging.
- Note: Some environments may restrict access to certain cookies. If nothing shows, fall back to Chrome DevTools → Application → Cookies workflow above.
### Extracting auth via DevTools (alternative)

If the popup’s cookie view is empty or you prefer DevTools:
1) Open DevTools on https://app.chathub.gg → Application → Cookies → https://app.chathub.gg
2) Copy relevant session cookies and build a Cookie header like:
   Cookie: name1=value1; name2=value2
3) Or, in Network tab, select a chat request → Headers → Request Headers and copy Authorization if present.
4) Paste into proxy-server/.env as CHATHUB_AUTH_COOKIE or CHATHUB_AUTH_HEADER respectively.

### Finding the chat API path

In DevTools → Network, send a message in ChatHub, then locate the request that carries your prompt.
Copy its path (e.g., /api/chat or similar) and set CHATHUB_API_PATH accordingly in proxy-server/.env.
