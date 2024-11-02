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

For detailed hosting instructions, check our [hosting guide](docs/HOSTING.md).

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
