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
    function addMessageToChat(message, isUser = true) {
        const div = document.createElement('div');
        div.className = isUser ? 'user-message' : 'ai-message';
        
        // Add timestamp
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const timeSpan = document.createElement('span');
        timeSpan.className = 'timestamp';
        timeSpan.textContent = timestamp;
        
        // Add message content
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        
        if (isUser) {
            contentDiv.textContent = message;
        } else {
            // Parse markdown and render HTML for AI messages
            contentDiv.innerHTML = marked.parse(message);
            
            // Fix: Wrap KaTeX rendering in try-catch
            try {
                renderMathInElement(contentDiv, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false}
                    ],
                    throwOnError: false,
                    output: 'html'
                });
            } catch (error) {
                console.error('Math rendering error:', error);
            }
            
            // Apply syntax highlighting to code blocks
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
        
        div.appendChild(contentDiv);
        div.appendChild(timeSpan);
        
        chatMessages.appendChild(div);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /**
     * Waits for Window AI extension to be available
     * @param {number} timeout - Maximum time to wait in milliseconds
     * @returns {Promise<boolean>} - Resolves to true if Window AI is available, false if timeout
     */
    async function waitForWindowAI(timeout = 2000) {
        return new Promise((resolve) => {
            if (window.ai) {
                console.log('Window AI found immediately');
                return resolve(true);
            }

            const timeoutId = setTimeout(() => {
                console.log('Window AI wait timed out');
                resolve(false);
            }, timeout);

            const interval = setInterval(() => {
                if (window.ai) {
                    console.log('Window AI found during interval check');
                    clearInterval(interval);
                    clearTimeout(timeoutId);
                    resolve(true);
                }
            }, 100);
        });
    }

    /**
     * Gets a response from the AI using Window AI extension
     * @param {string} message - The user's message to send to AI
     * @returns {Promise<string>} - The AI's response
     */
    async function getAIResponse(message) {
        try {
            const isAvailable = await waitForWindowAI();
            if (!isAvailable) {
                throw new Error('Window AI not available');
            }

            // Add error handling for empty or invalid messages
            if (!message || typeof message !== 'string') {
                throw new Error('Invalid message format');
            }
            
            sendButton.innerHTML = '<span class="loading">...</span>';
            
            const response = await window.ai.generateText({
                messages: [{
                    role: "user",
                    content: message
                }]
            });
            
            console.log('AI Response:', response);

            if (!response) {
                return 'No response received from the AI model.';
            }

            if (typeof response === 'string') {
                return response;
            }

            if (response.choices?.[0]?.message?.content) {
                return response.choices[0].message.content;
            }

            if (Array.isArray(response) && response.length > 0) {
                if (typeof response[0] === 'string') {
                    return response[0];
                }
                if (response[0]?.message?.content) {
                    return response[0].message.content;
                }
            }

            if (typeof response === 'object') {
                if (response.text) return response.text;
                if (response.content) return response.content;
                if (response.message?.content) return response.message.content;
            }

            return `Received response in unknown format: ${JSON.stringify(response)}`;

        } catch (error) {
            console.error('Generation error:', error);
            const errorMessage = error && typeof error === 'object' ? 
                error.message || 'Unknown error' : 
                String(error);
            return `Error: ${errorMessage}`;
        } finally {
            sendButton.textContent = 'Send';
        }
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

    // Optimize message handling with better error handling and loading states
    async function handleMessage(userMessage) {
        try {
            if (!userMessage.trim()) return;
            
            // Update UI state
            const uiState = {
                messageInput,
                sendButton,
                typingIndicator: document.createElement('div')
            };
            
            setLoadingState(true, uiState);
            addMessageToChat(userMessage, true);
            
            // Show typing indicator
            uiState.typingIndicator.className = 'typing-indicator';
            uiState.typingIndicator.innerHTML = '<span></span><span></span><span></span>';
            chatMessages.appendChild(uiState.typingIndicator);
            scrollToBottom();
            
            const aiResponse = await getAIResponse(userMessage);
            
            // Clean up and show response
            uiState.typingIndicator.remove();
            addMessageToChat(aiResponse || 'Sorry, I received no response. Please try again.', false);
            
        } catch (error) {
            console.error('Chat error:', error);
            addMessageToChat('An error occurred. Please try again.', false);
        } finally {
            setLoadingState(false, { messageInput, sendButton });
            scrollToBottom();
        }
    }

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
});