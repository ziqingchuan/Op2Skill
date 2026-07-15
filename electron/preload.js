"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: true,
    navigateBrowser(url) {
        return electron_1.ipcRenderer.invoke('browser:navigate', url);
    },
    browserBack() {
        return electron_1.ipcRenderer.invoke('browser:back');
    },
    browserForward() {
        return electron_1.ipcRenderer.invoke('browser:forward');
    },
    browserReload() {
        return electron_1.ipcRenderer.invoke('browser:reload');
    },
    browserSetZoom(factor) {
        return electron_1.ipcRenderer.invoke('browser:set-zoom', factor);
    },
    browserGetZoom() {
        return electron_1.ipcRenderer.invoke('browser:get-zoom');
    },
    browserClearCache() {
        return electron_1.ipcRenderer.invoke('browser:clear-cache');
    },
    browserClearCookies() {
        return electron_1.ipcRenderer.invoke('browser:clear-cookies');
    },
    browserShowContextMenu() {
        return electron_1.ipcRenderer.invoke('browser:show-context-menu');
    },
    setBrowserBounds(bounds) {
        return electron_1.ipcRenderer.invoke('browser:set-bounds', bounds);
    },
    setRecordingState(cmd, startTime = 0) {
        return electron_1.ipcRenderer.invoke('browser:set-recording-state', { cmd, startTime });
    },
    generateSkill(session) {
        return electron_1.ipcRenderer.invoke('skill:generate', session);
    },
    // Credential management
    browserGetCookies() {
        return electron_1.ipcRenderer.invoke('browser:get-cookies');
    },
    browserSetCookie(details) {
        return electron_1.ipcRenderer.invoke('browser:set-cookie', details);
    },
    browserRemoveCookie(url, name) {
        return electron_1.ipcRenderer.invoke('browser:remove-cookie', url, name);
    },
    browserGetPasswords() {
        return electron_1.ipcRenderer.invoke('browser:get-passwords');
    },
    browserSavePasswords(entries) {
        return electron_1.ipcRenderer.invoke('browser:save-passwords', entries);
    },
    browserSetModalVisible(visible) {
        return electron_1.ipcRenderer.invoke('browser:set-modal-visible', visible);
    },
    sessionsLoad() {
        return electron_1.ipcRenderer.invoke('sessions:load');
    },
    sessionsSave(data) {
        return electron_1.ipcRenderer.invoke('sessions:save', data);
    },
    // Event listeners
    onBrowserStateChange(callback) {
        const listener = (_event, state) => callback(state);
        electron_1.ipcRenderer.on('browser-state-change', listener);
        return () => electron_1.ipcRenderer.removeListener('browser-state-change', listener);
    },
    onBrowserRecorderEvent(callback) {
        const listener = (_event, recordedEvent) => callback(recordedEvent);
        electron_1.ipcRenderer.on('browser-recorder-event', listener);
        return () => electron_1.ipcRenderer.removeListener('browser-recorder-event', listener);
    },
    onBrowserZoomChange(callback) {
        const listener = (_event, factor) => callback(factor);
        electron_1.ipcRenderer.on('browser-zoom-change', listener);
        return () => electron_1.ipcRenderer.removeListener('browser-zoom-change', listener);
    },
    onOpenBrowserModal(callback) {
        const listener = (_event, type) => callback(type);
        electron_1.ipcRenderer.on('open-browser-modal', listener);
        return () => electron_1.ipcRenderer.removeListener('open-browser-modal', listener);
    },
});
