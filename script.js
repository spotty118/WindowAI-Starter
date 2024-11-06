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

    // Emoji picker functionality
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
        
        // Set cursor position after emoji
        const newCursorPosition = cursorPosition + emoji.length;
        messageInput.setSelectionRange(newCursorPosition, newCursorPosition);
        
        // Hide emoji picker after selection
        isEmojiPickerVisible = false;
        emojiPicker.style.display = 'none';
    });

    // Close emoji picker when clicking outside
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
            
            // Append content and timestamp in correct order
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
    let currentProvider = null;

    // Cache management
    class PromptCache {
        constructor() {
            this.cache = new Map();
            this.provider = null;
        }

        setProvider(provider) {
            if (this.provider !== provider) {
                this.cache.clear();
            }
            this.provider = provider;
        }

        async getResponse(message) {
            const cacheKey = JSON.stringify({ provider: this.provider, message });
            if (this.cache.has(cacheKey)) {
                return this.cache.get(cacheKey);
            }
            return null;
        }

        setResponse(message, response) {
            const cacheKey = JSON.stringify({ provider: this.provider, message });
            this.cache.set(cacheKey, response);
        }
    }

    // Initialize cache
    const promptCache = new PromptCache();

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
            const cachedResponse = await promptCache.getResponse(userMessage);
            if (cachedResponse) {
                addMessageToChat(cachedResponse, false);
                return;
            }

            // Generate new response
            const response = await getAIResponse(userMessage);
            if (response) {
                promptCache.setResponse(userMessage, response);
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
    async function getAIResponse(message) {
        try {
            if (!window.ai) {
                throw new Error('Window AI not available');
            }

            const response = await window.ai.generateText({
                messages: [{
                    role: "user",
                    content: message
                }]
            });

            return processResponse(response);

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

    // Add message debouncing to prevent spam
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };

    // Helper function to manage loading states
    function setLoadingState(isLoading, elements) {
        elements.messageInput.disabled = isLoading;
        elements.sendButton.disabled = isLoading;
        if (!isLoading) elements.messageInput.focus();
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

    // Add these memory management functions
    function cleanupMessageHistory() {
        // Limit chat history to last 100 messages to prevent memory bloat
        const messages = chatMessages.children;
        const maxMessages = 100;
        
        if (messages.length > maxMessages) {
            for (let i = 0; i < messages.length - maxMessages; i++) {
                messages[0].remove();
            }
        }
    }

    // Add message observer to monitor DOM size
    const messageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                // Temporarily remove content from invisible messages
                const message = entry.target;
                if (!message.dataset.originalContent) {
                    message.dataset.originalContent = message.innerHTML;
                    message.innerHTML = '';
                }
            } else {
                // Restore content when message becomes visible
                const message = entry.target;
                if (message.dataset.originalContent) {
                    message.innerHTML = message.dataset.originalContent;
                    delete message.dataset.originalContent;
                }
            }
        });
    }, {
        root: chatMessages,
        rootMargin: '100px'
    });

    // Add event listener cleanup on page unload
    window.addEventListener('unload', () => {
        messageObserver.disconnect();
        // Clear any remaining timeouts
        if (window.debounceTimeout) clearTimeout(window.debounceTimeout);
    });

    // Optimize image handling in messages
    function optimizeImages() {
        const images = chatMessages.getElementsByTagName('img');
        Array.from(images).forEach(img => {
            img.loading = 'lazy';
            img.decoding = 'async';
        });
    }

    // Add periodic cleanup
    setInterval(() => {
        if (document.hidden) {
            cleanupMessageHistory();
            // Force garbage collection of detached DOM elements
            if (window.gc) window.gc();
        }
    }, 60000); // Run every minute when tab is hidden

    // Add monitoring for cache usage
    function checkCacheUsage(response) {
        if (response.usage) {
            console.log('Cache metrics:', {
                cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
                cache_read_input_tokens: response.usage.cache_read_input_tokens
            });
        }
    }
});