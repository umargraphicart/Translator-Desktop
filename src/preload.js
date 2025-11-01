const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setApiKey: (key) => ipcRenderer.invoke('set-api-key', key),
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  testTranslation: (text, type) => ipcRenderer.invoke('test-translation', text, type),
  
  onNotification: (callback) => {
    ipcRenderer.on('show-notification', (event, message) => callback(message));
  },
  
  // Save to localStorage
  saveToStorage: (key, value) => {
    localStorage.setItem(key, value);
  },
  
  getFromStorage: (key) => {
    return localStorage.getItem(key);
  }
});
