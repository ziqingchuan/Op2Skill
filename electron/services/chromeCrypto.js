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
exports.getChromeMasterPassword = getChromeMasterPassword;
exports.deriveChromeKey = deriveChromeKey;
exports.getChromeDecryptionKey = getChromeDecryptionKey;
exports.decryptChromeValueBuffer = decryptChromeValueBuffer;
exports.decryptChromeValue = decryptChromeValue;
const child_process_1 = require("child_process");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const keytar = __importStar(require("keytar"));
const CHROME_KEYCHAIN = {
    darwin: { service: 'Chrome Safe Storage', account: 'Chrome' },
    linux: { service: 'chrome', account: 'Chrome' },
    win32: { service: 'Chrome', account: 'Chrome' },
};
const PBKDF2_ITERATIONS = {
    darwin: 1003,
    linux: 1,
    win32: 1,
    aix: 1,
    android: 1,
    freebsd: 1,
    haiku: 1,
    openbsd: 1,
    sunos: 1,
    cygwin: 1,
    netbsd: 1,
};
const MACOS_CBC_IV = Buffer.from(' '.repeat(16), 'utf8');
const DPAPI_PREFIX = Buffer.from('DPAPI', 'utf8');
async function getChromeMasterPassword() {
    const platform = process.platform;
    const entry = CHROME_KEYCHAIN[platform];
    if (!entry) {
        throw new Error(`当前平台 (${process.platform}) 暂不支持从 Chrome 导入`);
    }
    const password = await keytar.getPassword(entry.service, entry.account);
    return password ?? '';
}
function deriveChromeKey(masterPassword) {
    const iterations = PBKDF2_ITERATIONS[process.platform] ?? 1;
    return crypto.pbkdf2Sync(masterPassword, 'saltysalt', iterations, 16, 'sha1');
}
function getChromeUserDataDirFromProfile(profilePath) {
    return path.dirname(profilePath);
}
function readWindowsEncryptedKey(profilePath) {
    const localStatePath = path.join(getChromeUserDataDirFromProfile(profilePath), 'Local State');
    if (!fs.existsSync(localStatePath)) {
        throw new Error(`未找到 Chrome Local State: ${localStatePath}`);
    }
    const localState = JSON.parse(fs.readFileSync(localStatePath, 'utf-8'));
    const encryptedKeyBase64 = localState.os_crypt?.encrypted_key;
    if (!encryptedKeyBase64) {
        throw new Error('Chrome Local State 中未找到 os_crypt.encrypted_key');
    }
    const encryptedKey = Buffer.from(encryptedKeyBase64, 'base64');
    return encryptedKey.subarray(0, DPAPI_PREFIX.length).equals(DPAPI_PREFIX)
        ? encryptedKey.subarray(DPAPI_PREFIX.length)
        : encryptedKey;
}
function dpapiUnprotect(encryptedKey) {
    const script = `
$inputBase64 = [Console]::In.ReadToEnd()
$bytes = [Convert]::FromBase64String($inputBase64)
Add-Type -AssemblyName System.Security
$plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $null, [System.Security.Cryptography.DataProtectionScope]::CurrentUser)
[Convert]::ToBase64String($plain)
`;
    const output = (0, child_process_1.execFileSync)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
        input: encryptedKey.toString('base64'),
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 1024 * 1024,
    }).trim();
    if (!output)
        throw new Error('Windows DPAPI 解密 Chrome master key 失败');
    return Buffer.from(output, 'base64');
}
function getWindowsChromeKey(profilePath) {
    return dpapiUnprotect(readWindowsEncryptedKey(profilePath));
}
async function getChromeDecryptionKey(profilePath) {
    if (process.platform === 'win32')
        return getWindowsChromeKey(profilePath);
    return deriveChromeKey(await getChromeMasterPassword());
}
function decryptAesGcm(encrypted, key) {
    const nonce = encrypted.subarray(3, 15);
    const tag = encrypted.subarray(encrypted.length - 16);
    const ciphertext = encrypted.subarray(15, encrypted.length - 16);
    const algorithm = key.length === 32 ? 'aes-256-gcm' : 'aes-128-gcm';
    const decipher = crypto.createDecipheriv(algorithm, key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function decryptMacosAesCbc(encrypted, key) {
    const ciphertext = encrypted.subarray(3);
    if (ciphertext.length === 0 || ciphertext.length % 16 !== 0) {
        throw new Error('Chrome macOS CBC 密文长度无效');
    }
    const decipher = crypto.createDecipheriv('aes-128-cbc', key, MACOS_CBC_IV);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function decryptChromeValueBuffer(encrypted, key) {
    if (!encrypted.length)
        return Buffer.alloc(0);
    const prefix = encrypted.subarray(0, 3).toString('utf8');
    if (prefix !== 'v10' && prefix !== 'v11') {
        return encrypted;
    }
    try {
        return decryptAesGcm(encrypted, key);
    }
    catch (error) {
        if (process.platform !== 'darwin')
            throw error;
        return decryptMacosAesCbc(encrypted, key);
    }
}
function decryptChromeValue(encrypted, key) {
    return decryptChromeValueBuffer(encrypted, key).toString('utf8');
}
