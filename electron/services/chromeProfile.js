"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listChromeProfiles = listChromeProfiles;
exports.resolveChromeProfile = resolveChromeProfile;
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const CHROME_IMPORT_DEBUG = process.env.CHROME_IMPORT_DEBUG === '1';
function getChromeUserDataDir() {
    if (process.platform === 'darwin') {
        return path.join(os.homedir(), 'Library/Application Support/Google/Chrome');
    }
    if (process.platform === 'win32') {
        const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData/Local');
        return path.join(localAppData, 'Google/Chrome/User Data');
    }
    return path.join(os.homedir(), '.config/google-chrome');
}
function readProfileDisplayName(profileDir, folderName) {
    const prefsPath = path.join(profileDir, 'Preferences');
    if (!fs.existsSync(prefsPath))
        return folderName;
    try {
        const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
        return prefs.profile?.name?.trim() || folderName;
    }
    catch {
        return folderName;
    }
}
function resolveChromeCookiesPath(profileDir) {
    const candidates = [
        path.join(profileDir, 'Cookies'),
        path.join(profileDir, 'Network', 'Cookies'),
    ];
    return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}
function logChromeProfileDiscovery(profiles, userDataDir) {
    if (!CHROME_IMPORT_DEBUG)
        return;
    console.info('[chrome-import][profile-discovery]', {
        userDataDir,
        profiles: profiles.map((profile) => ({
            id: profile.id,
            path: profile.path,
            cookiesPath: profile.cookiesPath ?? null,
            hasCookies: profile.hasCookies,
            hasPasswords: profile.hasPasswords,
        })),
    });
}
function listChromeProfiles() {
    const userDataDir = getChromeUserDataDir();
    if (!fs.existsSync(userDataDir))
        return [];
    const entries = fs.readdirSync(userDataDir, { withFileTypes: true });
    const profileFolders = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .filter((name) => name === 'Default' || /^Profile \d+$/.test(name));
    const profiles = profileFolders.map((folderName) => {
        const profilePath = path.join(userDataDir, folderName);
        const cookiesPath = resolveChromeCookiesPath(profilePath);
        const loginDataPath = path.join(profilePath, 'Login Data');
        return {
            id: folderName,
            name: readProfileDisplayName(profilePath, folderName),
            path: profilePath,
            cookiesPath: cookiesPath ?? undefined,
            hasCookies: Boolean(cookiesPath),
            hasPasswords: fs.existsSync(loginDataPath),
        };
    });
    profiles.sort((a, b) => {
        if (a.id === 'Default')
            return -1;
        if (b.id === 'Default')
            return 1;
        return a.id.localeCompare(b.id, undefined, { numeric: true });
    });
    const result = profiles.filter((profile) => profile.hasCookies || profile.hasPasswords);
    logChromeProfileDiscovery(result, userDataDir);
    return result;
}
function resolveChromeProfile(profileId) {
    const profiles = listChromeProfiles();
    if (profiles.length === 0)
        return null;
    if (!profileId)
        return profiles[0];
    return profiles.find((profile) => profile.id === profileId) ?? null;
}
