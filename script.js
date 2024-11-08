document.addEventListener('DOMContentLoaded', function() {
    // Markdown configuration
    marked.setOptions({
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        },
        breaks: true
    });

    // Core DOM elements
    const messageInput = document.querySelector('#messageInput');
    const sendButton = document.querySelector('#sendButton');
    const chatMessages = document.querySelector('#chatMessages');
    const emojiButton = document.querySelector('#emojiButton');
    const emojiPicker = document.querySelector('emoji-picker');
    let isEmojiPickerVisible = false;

    emojiButton.addEventListener('click', () => {
        isEmojiPickerVisible = !isEmojiPickerVisible;
        emojiPicker.style.display = isEmojiPickerVisible ? 'block' : 'none';
    });

    emojiPicker.addEventListener('emoji-click', event => {
        const emoji = event.detail.unicode;
        const cursorPosition = messageInput.selectionStart;
        const textBeforeCursor = messageInput.value.substring(0, cursorPosition);
        const textAfterCursor = messageInput.value.substring(cursorPosition);
        
        messageInput.value = textBeforeCursor + emoji + textAfterCursor;
        messageInput.focus();
        
        const newCursorPosition = cursorPosition + emoji.length;
        messageInput.setSelectionRange(newCursorPosition, newCursorPosition);
        
        isEmojiPickerVisible = false;
        emojiPicker.style.display = 'none';
    });

    document.addEventListener('click', (event) => {
        if (!emojiPicker.contains(event.target) && !emojiButton.contains(event.target)) {
            isEmojiPickerVisible = false;
            emojiPicker.style.display = 'none';
        }
    });

    /**
     * Adds a message to the chat interface
     * @param {string} message - The message text to display
     * @param {boolean} isUser - True if message is from user, false if from AI
     */
    async function addMessageToChat(message, isUser = true) {
        try {
            const div = document.createElement('div');
            div.className = isUser ? 'user-message' : 'ai-message';
            
            const contentDiv = document.createElement('div');
            contentDiv.className = 'message-content';
            
            // Add timestamp
            const timeSpan = document.createElement('span');
            timeSpan.className = 'timestamp';
            timeSpan.textContent = new Date().toLocaleTimeString();
            
            if (isUser) {
                contentDiv.textContent = message;
            } else {
                const messageStr = typeof message === 'string' ? message : String(message);
                
                try {
                    marked.use({
                        gfm: true,
                        breaks: true,
                        headerIds: true,
                        mangle: false
                    });
                    
                    contentDiv.innerHTML = marked.parse(messageStr);
                    
                    if (window.renderMathInElement) {
                        renderMathInElement(contentDiv, {
                            delimiters: [
                                {left: '$$', right: '$$', display: true},
                                {left: '$', right: '$', display: false}
                            ],
                            throwOnError: false
                        });
                    }
                } catch (parseError) {
                    console.error('Markdown parsing error:', parseError);
                    contentDiv.textContent = messageStr;
                }
            }
            
            div.appendChild(contentDiv);
            div.appendChild(timeSpan);
            
            chatMessages.appendChild(div);
            scrollToBottom();
            
        } catch (error) {
            console.error('Failed to add message to chat:', error);
            const errorDiv = document.createElement('div');
            errorDiv.className = isUser ? 'user-message' : 'ai-message';
            errorDiv.textContent = typeof message === 'string' ? message : 'Error displaying message';
            chatMessages.appendChild(errorDiv);
        }
    }

    /**
     * Waits for Window AI extension to be available
     * @param {number} timeout - Maximum time to wait in milliseconds
     * @returns {Promise<boolean>} - Resolves to true if Window AI is available, false if timeout
     */
    async function waitForWindowAI(timeout = 5000) {
        return new Promise((resolve) => {
            if (window.ai) {
                console.log('Window AI found immediately');
                resolve(true);
                return;
            }

            const start = Date.now();
            const checker = setInterval(() => {
                if (window.ai) {
                    clearInterval(checker);
                    console.log('Window AI found after waiting');
                    resolve(true);
                } else if (Date.now() - start > timeout) {
                    clearInterval(checker);
                    console.log('Window AI not found after timeout');
                    resolve(false);
                }
            }, 100);
        });
    }

    // Global state management
    let isGenerating = false;

    // Cache management
    class SmartCache {
        constructor(maxSize = 100) {
            this.cache = new Map();
            this.maxSize = maxSize;
        }

        // Get exact or similar response considering context
        getResponse(message, previousMessages = []) {
            const normalizedMessage = message.toLowerCase().trim();
            const context = this.getRecentContext(previousMessages);

            // Try exact match with context
            for (const [key, entry] of this.cache.entries()) {
                const cacheData = JSON.parse(key);
                if (cacheData.message.toLowerCase() === normalizedMessage &&
                    this.contextMatches(context, cacheData.context)) {
                    console.log('Exact cache hit with matching context!');
                    entry.hitCount++;
                    entry.lastAccessed = Date.now();
                    return entry.response;
                }
            }

            return null;
        }

        getRecentContext(previousMessages) {
            // Get last 2 messages for context
            return previousMessages.slice(-2).map(msg => msg.toLowerCase().trim());
        }

        contextMatches(currentContext, cachedContext) {
            if (!currentContext.length && !cachedContext.length) return true;
            if (!currentContext.length || !cachedContext.length) return false;
            
            // Compare contexts
            return JSON.stringify(currentContext) === JSON.stringify(cachedContext);
        }

        setResponse(message, response, previousMessages = []) {
            const context = this.getRecentContext(previousMessages);
            const cacheKey = JSON.stringify({
                message: message.trim(),
                context: context
            });

            const entry = {
                response,
                timestamp: Date.now(),
                lastAccessed: Date.now(),
                hitCount: 1
            };

            this.cache.set(cacheKey, entry);
            
            if (this.cache.size > this.maxSize) {
                this.cleanup();
            }
        }

        cleanup() {
            const entries = Array.from(this.cache.entries())
                .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
            
            while (this.cache.size > this.maxSize) {
                const [key] = entries.shift();
                this.cache.delete(key);
            }
        }
    }

    // Initialize cache
    const smartCache = new SmartCache();

    // Message handling with proper state management
    async function handleMessage(userMessage) {
        if (!userMessage.trim() || isGenerating) return;
        
        try {
            isGenerating = true;
            addMessageToChat(userMessage, true);
            
            // Show typing indicator
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            typingIndicator.innerHTML = '<span></span><span></span><span></span>';
            chatMessages.appendChild(typingIndicator);
            
            // Check cache first
            const cachedResponse = smartCache.getResponse(userMessage);
            if (cachedResponse) {
                addMessageToChat(cachedResponse, false);
                return;
            }

            // Generate new response
            const response = await getAIResponse(userMessage);
            if (response) {
                smartCache.setResponse(userMessage, response);
                addMessageToChat(response, false);
            }

        } catch (error) {
            console.error('Chat error:', error);
            addMessageToChat('An error occurred. Please try again.', false);
        } finally {
            const typingIndicator = document.querySelector('.typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
            isGenerating = false;
        }
    }

    // AI response generation with provider detection
    async function getAIResponse(message, chatHistory = []) {
        try {
            // Check cache with context
            const previousMessages = chatHistory.map(msg => msg.content);
            const cachedResponse = smartCache.getResponse(message, previousMessages);
            if (cachedResponse) {
                return cachedResponse;
            }

            // If not in cache, generate new response
            if (!window.ai) {
                throw new Error('Window AI not available');
            }

            const response = await window.ai.generateText({
                messages: [{
                    role: "user",
                    content: message
                }]
            });

            const processedResponse = processResponse(response);
            
            // Cache the new response with context
            smartCache.setResponse(message, processedResponse, previousMessages);

            return processedResponse;

        } catch (error) {
            console.error('Generation error:', error);
            throw error;
        }
    }

    // Helper function to process response
    function processResponse(response) {
        if (!response) return 'No response received';
        
        // Handle string responses
        if (typeof response === 'string') return response;
        
        // Handle array responses
        if (Array.isArray(response)) {
            if (response.length === 0) return 'Empty response received';
            const firstResponse = response[0];
            return firstResponse?.content || firstResponse?.message?.content || String(firstResponse);
        }
        
        // Handle object responses
        if (typeof response === 'object') {
            return response.content || 
                   response.message?.content || 
                   response.text || 
                   JSON.stringify(response);
        }
        
        // Fallback
        return String(response);
    }

    // Helper function to scroll chat to bottom
    const scrollToBottom = () => chatMessages.scrollTop = chatMessages.scrollHeight;

    // Event listeners
    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message) {
            messageInput.value = '';
            handleMessage(message);
        }
    });

    messageInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter' && messageInput.value.trim()) {
            const message = messageInput.value.trim();
            messageInput.value = '';
            handleMessage(message);
        }
    });

    document.querySelector('.clear-chat').addEventListener('click', () => {
        const confirmation = confirm('⚠️ Warning: This will permanently delete all chat messages. Are you sure you want to continue?');
        
        if (confirmation) {
            try {
                chatMessages.innerHTML = '';
                addMessageToChat('Chat history has been cleared. Start a new conversation!', false);
            } catch (error) {
                console.error('Error clearing chat:', error);
                alert('An error occurred while clearing the chat. Please try again.');
            }
        }
    });

    // Initialize chat
    waitForWindowAI().then(isAvailable => {
        if (isAvailable) {
            addMessageToChat('Ready to chat! Type your message to begin.', false);
        } else {
            addMessageToChat('Waiting for Window AI extension...', false);
        }
    });

    // Prompt tool functionality
    const promptButton = document.querySelector('#promptButton');
    const promptTool = document.querySelector('#promptTool');
    const closePrompt = document.querySelector('.close-prompt');
    let isPromptToolVisible = false;

    const promptTemplates = [
        {
            title: "Code Review",
            text: "Please review this code and suggest improvements: \n```\n[paste code here]\n```"
        },
        {
            title: "Debug Help",
            text: "I'm getting this error: [error message]. Here's my code: \n```\n[paste code here]\n```"
        },
        {
            title: "Explain Code",
            text: "Can you explain how this code works? \n```\n[paste code here]\n```"
        },
        {
            title: "Optimize Code",
            text: "How can I optimize this code for better performance? \n```\n[paste code here]\n```"
        }
    ];

    function initializePromptTool() {
        const templatesContainer = document.querySelector('.prompt-templates');
        promptTemplates.forEach(template => {
            const div = document.createElement('div');
            div.className = 'prompt-template';
            div.textContent = template.title;
            div.addEventListener('click', () => {
                messageInput.value = template.text;
                messageInput.focus();
                togglePromptTool();
            });
            templatesContainer.appendChild(div);
        });
    }

    function togglePromptTool() {
        isPromptToolVisible = !isPromptToolVisible;
        promptTool.classList.toggle('hidden', !isPromptToolVisible);
    }

    promptButton.addEventListener('click', togglePromptTool);
    closePrompt.addEventListener('click', togglePromptTool);

    // Close prompt tool when clicking outside
    document.addEventListener('click', (event) => {
        if (!promptTool.contains(event.target) && !promptButton.contains(event.target)) {
            isPromptToolVisible = false;
            promptTool.classList.add('hidden');
        }
    });

    // Initialize prompt tool
    initializePromptTool();

    // Optional: Periodically clean old cache entries
    setInterval(() => {
        smartCache.clearOldEntries();
    }, 60 * 60 * 1000); // Clean every hour

    // Add this wherever you want to monitor cache performance
    function logCacheStats() {
        const stats = smartCache.getStats();
        console.log('Cache Stats:', stats);
        console.log('Cache Size:', stats.size);
        console.log('Total Tokens:', stats.tokenCount);
    }

    // Example usage:
    setInterval(logCacheStats, 5 * 60 * 1000); // Log every 5 minutes
});
