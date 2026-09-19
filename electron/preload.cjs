const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desk', {
  getState: () => ipcRenderer.invoke('window:state'),
  refresh: () => ipcRenderer.invoke('usage:refresh'),
  addAccount: (payload) => ipcRenderer.invoke('accounts:add', payload),
  updateAccount: (id, patch) => ipcRenderer.invoke('accounts:update', id, patch),
  setDefaultAccount: (id) => ipcRenderer.invoke('accounts:default', id),
  removeAccount: (id) => ipcRenderer.invoke('accounts:remove', id),
  signIn: (payload) => ipcRenderer.invoke('auth:signin', payload),
  cancelSignIn: () => ipcRenderer.invoke('auth:cancel'),
  importLogin: (provider) => ipcRenderer.invoke('auth:import', provider),
  chooseAuthFile: (provider) => ipcRenderer.invoke('auth:choose', provider),
  setTheme: (theme) => ipcRenderer.invoke('window:theme', theme),
  setRefresh: (minutes) => ipcRenderer.invoke('window:refresh', minutes),
  setPinned: (pinned) => ipcRenderer.invoke('window:pin', pinned),
  setCompact: (payload) => ipcRenderer.invoke('window:compact', payload),
  hide: () => ipcRenderer.invoke('window:hide'),
  onAuthHint: (callback) => {
    const listener = (_event, hint) => callback(hint);
    ipcRenderer.on('auth:hint', listener);
    return () => ipcRenderer.removeListener('auth:hint', listener);
  },
  onRefreshRequest: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('usage:refresh-request', listener);
    return () => ipcRenderer.removeListener('usage:refresh-request', listener);
  },
});
