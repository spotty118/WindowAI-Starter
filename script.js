document.addEventListener('DOMContentLoaded', function() {
    // Core DOM elements
    const messageInput = document.querySelector('#messageInput');
    const sendButton = document.querySelector('#sendButton');
    const chatMessages = document.querySelector('#chatMessages');

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
        contentDiv.textContent = message;
        
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
            // Check if Window AI is already available
            if (window.ai) {
                console.log('Window AI found immediately');
                return resolve(true);
            }

            // Set timeout for waiting
            const timeoutId = setTimeout(() => {
                console.log('Window AI wait timed out');
                resolve(false);
            }, timeout);

            // Check periodically for Window AI
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
     * @throws {Error} - If Window AI is not available or other errors occur
     */
    async function getAIResponse(message) {
        try {
            const isAvailable = await waitForWindowAI();
            if (!isAvailable) {
                throw new Error('Window AI not available. Please check the extension is enabled.');
            }

            // Show loading state
            sendButton.innerHTML = '<span class="loading">...</span>';
            
            // Make request to Window AI
            const response = await window.ai.generateText({
                messages: [{
                    role: "user",
                    content: message
                }]
            });
            
            console.log('AI Response:', response);
            return response[0].message.content;

        } catch (error) {
            console.error('Generation error:', error);
            throw error;
        } finally {
            // Reset button
            sendButton.textContent = 'Send';
        }
    }

    /**
     * Handles the complete message flow from user input to AI response
     * @param {string} userMessage - The user's message
     */
    async function handleMessage(userMessage) {
        try {
            // Disable input while processing
            messageInput.disabled = true;
            sendButton.disabled = true;

            // Display user message and get AI response
            addMessageToChat(userMessage, true);
            const aiResponse = await getAIResponse(userMessage);
            addMessageToChat(aiResponse, false);

        } catch (error) {
            addMessageToChat(`Error: ${error.message}`, false);
        } finally {
            // Re-enable input
            messageInput.disabled = false;
            sendButton.disabled = false;
            messageInput.focus();
        }
    }

    // Event listener for send button
    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message) {
            messageInput.value = '';
            handleMessage(message);
        }
    });

    // Event listener for Enter key
    messageInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter' && messageInput.value.trim()) {
            const message = messageInput.value.trim();
            messageInput.value = '';
            handleMessage(message);
        }
    });

    // Initialize chat interface
    waitForWindowAI().then(isAvailable => {
        if (isAvailable) {
            addMessageToChat('Ready to chat! Type your message to begin.', false);
        } else {
            addMessageToChat('Waiting for Window AI extension...', false);
        }
    });
});