document.addEventListener('DOMContentLoaded', function() {
    // Initialize markdown-it with Prism.js highlighting
    const md = markdownit({
        highlight: function (str, lang) {
            if (lang && Prism.languages[lang]) {
                try {
                    return Prism.highlight(str, Prism.languages[lang], lang);
                } catch (__) {}
            }
            return '';
        }
    });

    // Core DOM elements
    const messageInput = document.querySelector('#messageInput');
    const sendButton = document.querySelector('#sendButton');
    const chatMessages = document.querySelector('#chatMessages');

    // Emoji picker functionality
    const emojiButton = document.querySelector('#emojiButton');
    const emojiPicker = document.querySelector('emoji-picker');
    let isEmojiPickerVisible = false;

    // Lazy load emoji picker
    let emojiPickerLoaded = false;

    emojiButton.addEventListener('click', async () => {
        if (!emojiPickerLoaded) {
            await import('./emoji-picker.js');
            emojiPickerLoaded = true;
        }
        // Show emoji picker
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

    emojiPicker.addEventListener('error', (e) => {
        console.warn('Emoji picker failed to load:', e);
        emojiButton.style.display = 'none'; // Hide emoji button if picker fails
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
                    // Sanitize the markdown content
                    const sanitizedContent = DOMPurify.sanitize(messageStr);
                    // Convert markdown to HTML
                    const htmlContent = md.render(sanitizedContent);
                    contentDiv.innerHTML = htmlContent;

                    // Initialize copy buttons for code blocks
                    const codeBlocks = contentDiv.querySelectorAll('pre code');
                    codeBlocks.forEach((block, index) => {
                        const button = document.createElement('button');
                        button.className = 'copy-code-button';
                        button.innerHTML = 'Copy';
                        button.setAttribute('data-clipboard-target', `#code-${index}`);
                        block.id = `code-${index}`;
                        block.parentNode.insertBefore(button, block);
                    });

                    // Initialize Clipboard.js for new buttons
                    initializeClipboard();

                    // Initialize tooltips
                    tippy('[data-tippy-content]', {
                        theme: 'light',
                        placement: 'top'
                    });

                } catch (parseError) {
                    console.error('Parsing error:', parseError);
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
    let currentProvider = null;

    // Cache management
    class PromptCache {
        constructor(maxSize = 100) {
            this.cache = new Map();
            this.provider = null;
            this.maxSize = maxSize;
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
            if (this.cache.size >= this.maxSize) {
                const firstKey = this.cache.keys().next().value;
                this.cache.delete(firstKey);
            }
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
            scrollToBottom();
            
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
        if (event.key === 'Enter' && !event.shiftKey && messageInput.value.trim()) {
            event.preventDefault();
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

    // Prompt builder functionality
    const promptBuilderOverlay = document.querySelector('.prompt-builder-overlay');
    const promptBuilder = document.querySelector('.prompt-builder');
    const toggleButton = document.querySelector('#togglePromptBuilder');
    const closeButton = document.querySelector('.close-prompt');
    const promptTemplate = document.querySelector('#promptTemplate');
    const promptFields = document.querySelector('#promptFields');
    const insertPrompt = document.querySelector('#insertPrompt');

    // Debug logging
    console.log('Elements found:', {
        promptBuilderOverlay: !!promptBuilderOverlay,
        promptBuilder: !!promptBuilder,
        toggleButton: !!toggleButton,
        closeButton: !!closeButton,
        promptTemplate: !!promptTemplate,
        promptFields: !!promptFields,
        insertPrompt: !!insertPrompt
    });

    if (!promptBuilderOverlay || !promptBuilder || !toggleButton) {
        console.error('Prompt builder overlay, prompt builder, or toggle button not found');
    } else {
        // Function to open the prompt builder
        function openPromptBuilder(event) {
            event.stopPropagation(); // Prevent event bubbling
            promptBuilderOverlay.classList.remove('hidden');
            promptBuilderOverlay.classList.add('visible');
            
            // Move focus to the first input field after the modal is visible
            setTimeout(() => {
                const firstInput = promptBuilder.querySelector('input, select, textarea');
                if (firstInput) firstInput.focus();
            }, 300); // Delay to allow CSS transition
        }

        // Function to close the prompt builder
        function closePromptBuilder(event) {
            if (event?.stopPropagation) {
                event.stopPropagation();
            }
            promptBuilderOverlay.classList.remove('visible');
            promptBuilderOverlay.classList.add('hidden');
            
            // Ensure focus is returned after animation
            requestAnimationFrame(() => {
                toggleButton.focus();
            });
        }

        // Toggle prompt builder on button click
        toggleButton.addEventListener('click', openPromptBuilder);

        // Close prompt builder when clicking the close button
        closeButton.addEventListener('click', closePromptBuilder);

        // Close prompt builder when clicking outside the prompt modal
        promptBuilderOverlay.addEventListener('click', (event) => {
            if (event.target === promptBuilderOverlay) {
                closePromptBuilder(event);
            }
        });

        // Template definitions
        const templates = {
            explain: {
                fields: [
                    { name: 'concept', label: 'Concept', type: 'text' }
                ],
                template: 'Please explain {concept} in simple terms.'
            },
            compare: {
                fields: [
                    { name: 'item1', label: 'Item 1', type: 'text' },
                    { name: 'item2', label: 'Item 2', type: 'text' }
                ],
                template: 'Compare {item1} and {item2}, highlighting key differences and similarities.'
            },
            code: {
                fields: [
                    { 
                        name: 'language', 
                        label: 'Language', 
                        type: 'select', 
                        options: ['JavaScript', 'Python', 'Java', 'C++', 'Ruby', 'Go', 'C#', 'PHP', 'TypeScript'] 
                    },
                    { name: 'concept', label: 'Concept', type: 'text' }
                ],
                template: 'Explain how to implement {concept} in {language} with examples.'
            },
            summarize: {
                fields: [
                    { name: 'summary_length', label: 'Summary Length', type: 'select', options: ['Short', 'Medium', 'Long'] },
                    { name: 'text_to_summarize', label: 'Text to Summarize', type: 'textarea' }
                ],
                template: 'Please provide a {summary_length} summary of the following text:\n\n{text_to_summarize}'
            },
            generateQuiz: {
                fields: [
                    { name: 'content', label: 'Content', type: 'textarea' },
                    { name: 'number_of_questions', label: 'Number of Questions', type: 'number' },
                    { name: 'question_type', label: 'Question Type', type: 'select', options: ['Multiple Choice', 'Open-Ended'] }
                ],
                template: 'Create {number_of_questions} {question_type} questions based on the following content:\n\n{content}'
            },
            translate: {
                fields: [
                    { 
                        name: 'source_language', 
                        label: 'Source Language', 
                        type: 'select', 
                        options: ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Portuguese', 'Russian'] 
                    },
                    { 
                        name: 'target_language', 
                        label: 'Target Language', 
                        type: 'select', 
                        options: ['English', 'Spanish', 'French', 'German', 'Chinese', 'Japanese', 'Korean', 'Arabic', 'Portuguese', 'Russian'] 
                    },
                    { name: 'text_to_translate', label: 'Text to Translate', type: 'textarea' }
                ],
                template: 'Translate the following text from {source_language} to {target_language}:\n\n{text_to_translate}'
            },
            // Add more templates as needed...
        };

        // Handle template selection
        promptTemplate.addEventListener('change', (e) => {
            try {
                const selected = templates[e.target.value];
                if (!selected) {
                    promptFields.innerHTML = '';
                    return;
                }
                
                promptFields.innerHTML = selected.fields.map(field => {
                    if (field.type === 'select') {
                        return `
                            <div class="prompt-field">
                                <label for="${field.name}">${field.label}:</label>
                                <select id="${field.name}" name="${field.name}" required>
                                    <option value="">Select an option...</option>
                                    ${field.options.map(option => `<option value="${option}">${option}</option>`).join('')}
                                </select>
                                <span class="error-message"></span>
                            </div>
                        `;
                    } else if (field.type === 'textarea') {
                        return `
                            <div class="prompt-field">
                                <label for="${field.name}">${field.label}:</label>
                                <textarea id="${field.name}" name="${field.name}" rows="4" required></textarea>
                                <span class="error-message"></span>
                            </div>
                        `;
                    } else {
                        return `
                            <div class="prompt-field">
                                <label for="${field.name}">${field.label}:</label>
                                <input type="text" id="${field.name}" name="${field.name}" required>
                                <span class="error-message"></span>
                            </div>
                        `;
                    }
                }).join('');
            } catch (error) {
                console.error('Error handling template selection:', error);
                promptFields.innerHTML = '';
            }
        });

        // Handle prompt insertion with validation
        if (insertPrompt) {
            insertPrompt.addEventListener('click', () => {
                try {
                    const selected = templates[promptTemplate.value];
                    if (!selected) return;

                    let prompt = selected.template;

                    // Clear previous errors
                    clearValidationErrors();

                    // Validate and collect field values
                    const fieldValues = validateFields(selected.fields);

                    if (fieldValues.missingFields.length > 0) {
                        handleMissingFields(fieldValues.missingFields);
                        return;
                    }

                    // Build prompt with validated values
                    prompt = buildPromptString(prompt, fieldValues.values);

                    messageInput.value = prompt;
                    closePromptBuilder();
                    messageInput.focus();
                } catch (error) {
                    console.error('Error in prompt builder:', error);
                    showErrorMessage('Failed to build prompt. Please try again.');
                }
            });
        }
    }

    // Memory management functions
    function cleanupMessageHistory() {
        const messages = chatMessages.children;
        const maxMessages = 100;
        
        if (messages.length > maxMessages) {
            const fragment = document.createDocumentFragment();
            Array.from(messages)
                .slice(-maxMessages)
                .forEach(msg => fragment.appendChild(msg));
            chatMessages.innerHTML = '';
            chatMessages.appendChild(fragment);
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

    // Observe messages for memory management
    const observeMessages = () => {
        Array.from(chatMessages.children).forEach(child => {
            messageObserver.observe(child);
        });
    };

    // Initial observation
    observeMessages();

    // Observe future messages
    const mutationObserver = new MutationObserver(() => {
        observeMessages();
    });

    mutationObserver.observe(chatMessages, { childList: true });

    // Add event listener cleanup on page unload
    window.addEventListener('unload', () => {
        messageObserver.disconnect();
        mutationObserver.disconnect();
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
            // Force garbage collection of detached DOM elements if supported
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

    // Scroll to bottom on new messages
    chatMessages.addEventListener('scroll', () => {
        // Any scroll handlers if needed
    }, { passive: true });

    // Add this after DOMContentLoaded
    tippy('[data-tippy-content]', {
        theme: 'light',
        placement: 'top'
    });

    // Initialize Clipboard.js
    function initializeClipboard() {
        const clipboard = new ClipboardJS('.copy-code-button');
        clipboard.on('success', (e) => {
            // Provide user feedback
            e.trigger.textContent = 'Copied!';
            setTimeout(() => {
                e.trigger.textContent = 'Copy';
            }, 2000);
        });
    }

    // Initialize Tippy.js tooltips
    tippy('[data-tippy-content]', {
        theme: 'light',
        placement: 'top'
    });

    // Initialize Prism.js for syntax highlighting
    Prism.highlightAll();

    // Initialize Prism.js for syntax highlighting
    function highlightCodeBlocks() {
        // Highlight code blocks within new content
        const codeBlocks = chatMessages.querySelectorAll('pre code');
        codeBlocks.forEach((block) => {
            Prism.highlightElement(block);
        });
    }

    // Initialize Tippy.js tooltips
    function initializeTooltips() {
        tippy('[data-tippy-content]', {
            theme: 'light',
            placement: 'top'
        });
    }

    // Instead of updating DOM for each message
    function addMessageBatch(messages) {
        // Create document fragment
        const fragment = document.createDocumentFragment();
        
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            // Add message content
            fragment.appendChild(messageDiv);
        });
        
        // Single DOM update
        chatMessages.appendChild(fragment);
    }

    // Use event delegation instead of multiple listeners
    chatMessages.addEventListener('click', (event) => {
        if (event.target.matches('.copy-code-button')) {
            // Handle copy button click
        } else if (event.target.matches('.emoji-button')) {
            // Handle emoji button click
        }
    });

    // Use requestAnimationFrame for smooth animations
    function animateScroll(element, to, duration) {
        const start = element.scrollTop;
        const change = to - start;
        let currentTime = 0;

        function animate(timestamp) {
            currentTime += 16;
            const val = easeInOutQuad(currentTime, start, change, duration);
            element.scrollTop = val;
            if (currentTime < duration) {
                requestAnimationFrame(animate);
            }
        }
        requestAnimationFrame(animate);
    }

    // Add performance marks to measure critical operations
    performance.mark('chatStart');

    // After chat initialization
    performance.mark('chatEnd');
    performance.measure('chatInitialization', 'chatStart', 'chatEnd');

    // Initialize lazy loading
    const observer = lozad();
    observer.observe();
});
