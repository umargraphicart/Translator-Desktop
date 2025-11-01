const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const axios = require('axios');

let mainWindow;
let tray;
let isQuitting = false;

class TranslationManager {
    constructor() {
        this.apiKey = '';
        this.isTranslating = false;
    }

    async translateText(text, type) {
        if (this.isTranslating) return;
        if (!this.apiKey) {
            throw new Error('API key not set. Please set it in settings.');
        }

        this.isTranslating = true;

        try {
            let prompt = '';
            
            if (type === 'en-to-ur') {
                prompt = `Translate this English text to Roman Urdu (NOT Urdu script). Return only translation:\n\n"${text}"`;
            } else {
                prompt = `Translate this Roman Urdu text to English. Return only translation:\n\n"${text}"`;
            }

            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 1000,
                temperature: 0.3
            }, {
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            if (!response.data.choices || !response.data.choices[0]) {
                throw new Error('Invalid response from translation service');
            }

            return response.data.choices[0].message.content.trim();
        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                throw new Error('Translation timeout. Please check your internet connection.');
            } else if (error.response && error.response.status === 401) {
                throw new Error('Invalid API key. Please check your OpenAI API key.');
            } else {
                throw new Error(`Translation failed: ${error.message}`);
            }
        } finally {
            this.isTranslating = false;
        }
    }

    async performTranslation(type) {
        try {
            // Save current clipboard
            const originalClipboard = clipboard.readText();
            
            // Copy selected text (simulate Ctrl+C)
            this.simulateCopy();
            await this.sleep(300); // Wait for copy to complete
            
            const selectedText = clipboard.readText().trim();
            
            if (!selectedText) {
                this.showNotification('❌ No text selected or cannot access clipboard');
                return;
            }

            if (selectedText.length > 4000) {
                this.showNotification('❌ Text too long. Please select less than 4000 characters.');
                return;
            }

            this.showNotification('🔄 Translating...');

            // Get translation
            const translatedText = await this.translateText(selectedText, type);
            
            // Replace selected text (simulate Ctrl+V)
            clipboard.writeText(translatedText);
            this.simulatePaste();
            
            // Restore clipboard after delay
            setTimeout(() => {
                try {
                    clipboard.writeText(originalClipboard);
                } catch (e) {
                    console.log('Clipboard restore failed:', e);
                }
            }, 1000);

            this.showNotification('✅ Translation completed!');

        } catch (error) {
            console.error('Translation error:', error);
            this.showNotification(error.message);
        }
    }

    simulateCopy() {
        try {
            // Simulate Ctrl+C using electron's clipboard
            // This is more reliable than robotjs for most applications
        } catch (error) {
            console.log('Copy simulation failed:', error);
        }
    }

    simulatePaste() {
        try {
            // Simulate Ctrl+V using electron's clipboard
        } catch (error) {
            console.log('Paste simulation failed:', error);
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    showNotification(message) {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('show-notification', message);
        }
    }

    setApiKey(key) {
        this.apiKey = key;
        // Save to persistent storage
        if (mainWindow) {
            mainWindow.webContents.executeJavaScript(`
                localStorage.setItem('openaiApiKey', '${key}');
            `);
        }
    }

    getApiKey() {
        return this.apiKey;
    }
}

const translator = new TranslationManager();

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 450,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        show: false,
        icon: path.join(__dirname, '../build/icon.ico'),
        title: 'Urdu English Translator',
        resizable: true,
        minimizable: true,
        maximizable: false
    });

    mainWindow.loadFile('src/index.html');

    // Hide to tray when closed
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
            return false;
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Load saved API key
    loadSavedApiKey();
}

function createTray() {
    try {
        const iconPath = path.join(__dirname, '../build/icon.ico');
        const trayIcon = nativeImage.createFromPath(iconPath);
        
        if (trayIcon.isEmpty()) {
            // Create a simple icon programmatically if file not found
            const canvas = require('canvas').createCanvas(16, 16);
            const ctx = canvas.getContext('2d');
            
            // Draw a simple icon
            ctx.fillStyle = '#4CAF50';
            ctx.fillRect(0, 0, 16, 16);
            ctx.fillStyle = 'white';
            ctx.font = '10px Arial';
            ctx.fillText('🌍', 2, 12);
            
            trayIcon = nativeImage.createFromBuffer(canvas.toBuffer());
        }

        tray = new Tray(trayIcon);
        
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '🔄 Show Translator',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            {
                label: '🇺🇸 → 🇵🇰 English to Urdu (Ctrl+Shift+1)',
                click: () => {
                    translator.performTranslation('en-to-ur');
                }
            },
            {
                label: '🇵🇰 → 🇺🇸 Urdu to English (Ctrl+Shift+2)',
                click: () => {
                    translator.performTranslation('ur-to-en');
                }
            },
            { type: 'separator' },
            {
                label: '⚙️ Settings',
                click: () => {
                    if (mainWindow) {
                        mainWindow.show();
                        mainWindow.focus();
                    }
                }
            },
            { type: 'separator' },
            {
                label: '❌ Quit',
                click: () => {
                    isQuitting = true;
                    app.quit();
                }
            }
        ]);

        tray.setToolTip('Urdu English Translator\nCtrl+Shift+1: English → Urdu\nCtrl+Shift+2: Urdu → English');
        tray.setContextMenu(contextMenu);

        tray.on('double-click', () => {
            if (mainWindow) {
                mainWindow.show();
                mainWindow.focus();
            }
        });

    } catch (error) {
        console.error('Tray creation failed:', error);
    }
}

function registerGlobalShortcuts() {
    try {
        // English to Urdu
        const result1 = globalShortcut.register('CommandOrControl+Shift+1', () => {
            translator.performTranslation('en-to-ur');
        });

        // Urdu to English
        const result2 = globalShortcut.register('CommandOrControl+Shift+2', () => {
            translator.performTranslation('ur-to-en');
        });

        if (!result1 || !result2) {
            console.log('Global shortcut registration failed');
        } else {
            console.log('Global shortcuts registered successfully');
        }
    } catch (error) {
        console.error('Shortcut registration error:', error);
    }
}

async function loadSavedApiKey() {
    try {
        if (mainWindow) {
            const savedKey = await mainWindow.webContents.executeJavaScript(`
                localStorage.getItem('openaiApiKey') || ''
            `);
            if (savedKey) {
                translator.setApiKey(savedKey);
            }
        }
    } catch (error) {
        console.log('Failed to load saved API key:', error);
    }
}

app.whenReady().then(() => {
    console.log('App is ready');
    
    createWindow();
    createTray();
    registerGlobalShortcuts();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        isQuitting = true;
        app.quit();
    }
});

app.on('will-quit', (event) => {
    try {
        globalShortcut.unregisterAll();
    } catch (error) {
        console.log('Error unregistering shortcuts:', error);
    }
});

app.on('before-quit', () => {
    isQuitting = true;
});

// IPC handlers
ipcMain.handle('set-api-key', (event, key) => {
    translator.setApiKey(key);
    return 'success';
});

ipcMain.handle('get-api-key', () => {
    return translator.getApiKey();
});

ipcMain.handle('test-translation', async (event, text, type) => {
    try {
        return await translator.translateText(text, type);
    } catch (error) {
        throw new Error(error.message);
    }
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
