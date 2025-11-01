document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveKeyButton = document.getElementById('saveKey');
    const testEnToUrButton = document.getElementById('testEnToUr');
    const testUrToEnButton = document.getElementById('testUrToEn');
    const testTextInput = document.getElementById('testText');
    const statusDiv = document.getElementById('status');

    // Load saved API key
    loadApiKey();

    saveKeyButton.addEventListener('click', saveApiKey);
    testEnToUrButton.addEventListener('click', () => testTranslation('en-to-ur'));
    testUrToEnButton.addEventListener('click', () => testTranslation('ur-to-en'));

    // Listen for notifications from main process
    window.electronAPI.onNotification((message) => {
        showStatus(message, 'success');
    });

    // Load saved API key from localStorage
    async function loadApiKey() {
        try {
            const savedKey = localStorage.getItem('openaiApiKey');
            if (savedKey) {
                await window.electronAPI.setApiKey(savedKey);
                apiKeyInput.placeholder = 'API key is saved (click to change)';
                showStatus('✅ API key loaded successfully!', 'success');
            } else {
                showStatus('⚠️ Please set your OpenAI API key to start translating', 'info');
            }
        } catch (error) {
            console.log('Error loading API key:', error);
        }
    }

    async function saveApiKey() {
        const apiKey = apiKeyInput.value.trim();
        if (apiKey && apiKey.startsWith('sk-')) {
            try {
                await window.electronAPI.setApiKey(apiKey);
                localStorage.setItem('openaiApiKey', apiKey);
                showStatus('✅ API key saved successfully!', 'success');
                apiKeyInput.value = '';
                apiKeyInput.placeholder = 'API key is saved (click to change)';
                
                // Auto-hide status after 3 seconds
                setTimeout(() => {
                    statusDiv.textContent = '';
                    statusDiv.className = 'status';
                }, 3000);
                
            } catch (error) {
                showStatus('❌ Failed to save API key: ' + error.message, 'error');
            }
        } else {
            showStatus('❌ Please enter a valid OpenAI API key (should start with sk-)', 'error');
        }
    }

    async function testTranslation(type) {
        const text = testTextInput.value.trim();
        if (!text) {
            showStatus('❌ Please enter text to test', 'error');
            return;
        }

        if (text.length > 1000) {
            showStatus('❌ Test text too long. Please use less than 1000 characters.', 'error');
            return;
        }

        try {
            showStatus('🔄 Testing translation...', 'info');
            const result = await window.electronAPI.testTranslation(text, type);
            showStatus(`✅ Translation: ${result}`, 'success');
        } catch (error) {
            showStatus(`❌ Test failed: ${error.message}`, 'error');
        }
    }

    function showStatus(message, type) {
        statusDiv.textContent = message;
        statusDiv.className = `status ${type}`;
        
        // Auto-hide success/info messages after 5 seconds
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (statusDiv.textContent === message) {
                    statusDiv.textContent = '';
                    statusDiv.className = 'status';
                }
            }, 5000);
        }
    }

    // Handle Enter key in input fields
    apiKeyInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            saveKeyButton.click();
        }
    });

    testTextInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            testEnToUrButton.click();
        }
    });

    // Load any saved API key on startup
    setTimeout(loadApiKey, 1000);
});
