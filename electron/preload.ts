import { contextBridge, ipcRenderer } from 'electron';
import type { SaveRequest } from '../src/types';
contextBridge.exposeInMainWorld('desktop', {
  saveKmz: (request: SaveRequest) => ipcRenderer.invoke('kmz:save', request),
  getAppVersion: () => ipcRenderer.invoke('app:version'),
});
