const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mapBuilder', {
  exportWorld: (payload) => ipcRenderer.invoke('export-world', payload),
  saveProject: (payload) => ipcRenderer.invoke('save-project', payload),
  openProject: () => ipcRenderer.invoke('open-project'),
  schemFolder: (choose) => ipcRenderer.invoke('schem-folder', choose),
  openSchemFolder: () => ipcRenderer.invoke('open-schem-folder'),
  importVillage: () => ipcRenderer.invoke('import-village'),
  getMobPresets: () => ipcRenderer.invoke('get-mob-presets'),
  setMobPresets: (list) => ipcRenderer.invoke('set-mob-presets', list),
  getTextures: (names) => ipcRenderer.invoke('get-textures', names),
  getEntityTextures: (paths) => ipcRenderer.invoke('get-entity-textures', paths),
  chooseTextureJar: () => ipcRenderer.invoke('choose-texture-jar'),
  loadSchem: (name) => ipcRenderer.invoke('load-schem', name),
});
