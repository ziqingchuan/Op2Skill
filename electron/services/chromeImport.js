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
exports.readChromeCookies = readChromeCookies;
exports.readChromePasswords = readChromePasswords;
exports.mergePasswords = mergePasswords;
exports.applyChromeImport = applyChromeImport;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const node_sqlite_1 = require("node:sqlite");
const chromeCrypto_1 = require("./chromeCrypto");
const chromeProfile_1 = require("./chromeProfile");
const CHROME_EPOCH_OFFSET = 11644473600n;
const CHROME_IMPORT_DEBUG = process.env.CHROME_IMPORT_DEBUG === '1';
function makeTempDbPath(sourcePath) {
    return path.join(os.tmpdir(), `op2skill-chrome-${path.basename(sourcePath)}-${Date.now()}.db`);
}
function openSqliteViaTempCopy(sourcePath) {
    const tempPath = makeTempDbPath(sourcePath);
    fs.copyFileSync(sourcePath, tempPath);
    return new node_sqlite_1.DatabaseSync(tempPath, { readOnly: true });
}
// Windows 上 fs.copyFileSync 底层走 CopyFileW，要求源文件未被独占锁定；
// Chrome 打开 Network\Cookies / Login Data 时持有独占锁，CopyFileW 会直接 EBUSY。
// fs.readFileSync/fs.open 走的是 CreateFileW，以更宽松的共享模式打开文件，
// 通常仍能在 Chrome 独占锁存在时读取到字节，所以改为手动读字节再写入临时文件。
function openSqliteViaRawReadCopy(sourcePath) {
    const tempPath = makeTempDbPath(sourcePath);
    const data = fs.readFileSync(sourcePath);
    fs.writeFileSync(tempPath, data);
    return new node_sqlite_1.DatabaseSync(tempPath, { readOnly: true });
}
function openSqliteReadonly(sourcePath) {
    // macOS: Chrome 常驻后台会对 Cookies/Login Data 持有共享锁，直接只读打开在锁存在时
    // 会成功但读取时报 "database is locked"；复制到临时文件再打开可以绕开这个锁，
    // 这是 mac 上原本验证稳定的行为，不要改回"先直接打开"。
    if (process.platform === 'darwin') {
        return openSqliteViaTempCopy(sourcePath);
    }
    // Windows: 依次尝试 直接只读打开 → copyFileSync 复制 → 原始字节读写复制，
    // 覆盖 Chrome 独占锁导致 CopyFileW 失败（EBUSY）的场景。
    try {
        return new node_sqlite_1.DatabaseSync(sourcePath, { readOnly: true });
    }
    catch {
        try {
            return openSqliteViaTempCopy(sourcePath);
        }
        catch {
            return openSqliteViaRawReadCopy(sourcePath);
        }
    }
}
function chromeExpiryToUnix(expiresUtc) {
    if (expiresUtc == null || expiresUtc === '' || expiresUtc === 0 || expiresUtc === 0n)
        return undefined;
    const chromeMicros = typeof expiresUtc === 'bigint'
        ? expiresUtc
        : BigInt(String(expiresUtc));
    if (chromeMicros <= 0n)
        return undefined;
    const unixSeconds = chromeMicros / 1000000n - CHROME_EPOCH_OFFSET;
    if (unixSeconds <= 0n || unixSeconds > BigInt(Number.MAX_SAFE_INTEGER))
        return undefined;
    return Number(unixSeconds);
}
function cookieUrl(hostKey, pathValue, secure) {
    const host = hostKey.startsWith('.') ? hostKey.slice(1) : hostKey;
    const scheme = secure ? 'https' : 'http';
    const normalizedPath = pathValue.startsWith('/') ? pathValue : `/${pathValue}`;
    return `${scheme}://${host}${normalizedPath}`;
}
function mapSameSite(value) {
    switch (value) {
        case 0:
            return 'no_restriction';
        case 1:
            return 'lax';
        case 2:
            return 'strict';
        default:
            return 'unspecified';
    }
}
function matchesDomainFilter(hostKey, domainFilter) {
    if (!domainFilter?.trim())
        return true;
    const filter = domainFilter.trim().toLowerCase().replace(/^\./, '');
    const host = hostKey.toLowerCase().replace(/^\./, '');
    return host === filter || host.endsWith(`.${filter}`);
}
function toBuffer(value) {
    if (value == null)
        return null;
    if (Buffer.isBuffer(value))
        return value;
    if (value instanceof Uint8Array)
        return Buffer.from(value);
    if (typeof value === 'string')
        return Buffer.from(value, 'binary');
    return null;
}
function decryptField(plainValue, encryptedValue, key) {
    if (plainValue)
        return plainValue;
    const encrypted = toBuffer(encryptedValue);
    if (!encrypted || !encrypted.length)
        return '';
    return (0, chromeCrypto_1.decryptChromeValue)(encrypted, key);
}
function hasAsciiControlCharacters(value) {
    return value.some((byte) => byte < 0x20 || byte === 0x7f);
}
function getDisallowedCookieCharacters(value) {
    const chars = [];
    for (let index = 0; index < value.length; index++) {
        const code = value.charCodeAt(index);
        if (code < 0x20 || code === 0x7f) {
            chars.push(`index=${index}, code=0x${code.toString(16).padStart(2, '0')}`);
        }
    }
    return chars;
}
function hasDisallowedCookieCharacters(value) {
    return getDisallowedCookieCharacters(value).length > 0;
}
function formatOriginalCookie(row, value) {
    return JSON.stringify({
        name: row.name,
        domain: row.host_key,
        path: row.path || '/',
        secure: row.is_secure === 1,
        httpOnly: row.is_httponly === 1,
        sameSite: mapSameSite(row.samesite),
        expiresUtc: row.expires_utc,
        value,
    });
}
function formatDisallowedCookieWarning(row, value) {
    const chars = getDisallowedCookieCharacters(value);
    return `Cookie value 解密结果包含 Chromium 不允许的 ASCII 控制字符 (${chars.join('; ')})，与浏览器 DevTools 常见空值显示不一致；已按空值导入。解密结果快照: ${formatOriginalCookie(row, value)}`;
}
function bufferSnapshot(value) {
    if (!value)
        return null;
    return {
        length: value.length,
        hexHead: value.subarray(0, 64).toString('hex'),
        base64: value.toString('base64'),
        utf8Json: JSON.stringify(value.toString('utf8')),
    };
}
function cookieRowSnapshot(row) {
    const encrypted = toBuffer(row.encrypted_value);
    return {
        name: row.name,
        hostKey: row.host_key,
        path: row.path,
        valueJson: JSON.stringify(row.value),
        valueLength: row.value?.length ?? 0,
        encryptedValue: bufferSnapshot(encrypted),
        expiresUtc: row.expires_utc,
        secure: row.is_secure === 1,
        httpOnly: row.is_httponly === 1,
        sameSite: mapSameSite(row.samesite),
    };
}
function logCookieImportDebug(stage, row, payload) {
    if (!CHROME_IMPORT_DEBUG)
        return;
    console.info(`[chrome-import][cookie][${row.name}@${row.host_key}][${stage}]`, payload);
}
function stripChromeCookieHostHash(value, hostKey) {
    if (value.length < 32)
        return { value, stripped: false };
    const hostVariants = new Set([hostKey, hostKey.replace(/^\./, '')]);
    for (const host of hostVariants) {
        const hostHash = crypto.createHash('sha256').update(host).digest();
        if (value.subarray(0, 32).equals(hostHash)) {
            return { value: value.subarray(32), stripped: true };
        }
    }
    if (!hasAsciiControlCharacters(value))
        return { value, stripped: false };
    for (let offset = 32; offset <= Math.min(64, value.length - 1); offset++) {
        const strippedValue = value.subarray(offset);
        if (strippedValue.length > 0 && !hasAsciiControlCharacters(strippedValue)) {
            return { value: strippedValue, stripped: true };
        }
    }
    return { value, stripped: false };
}
function buildCookieDetails(row, value) {
    const isHostPrefixed = row.name.startsWith('__Host-');
    const isSecurePrefixed = isHostPrefixed || row.name.startsWith('__Secure-');
    const secure = row.is_secure === 1 || isSecurePrefixed;
    const details = {
        url: cookieUrl(row.host_key, isHostPrefixed ? '/' : row.path, secure),
        name: row.name,
        value,
        path: isHostPrefixed ? '/' : row.path || '/',
        secure,
        httpOnly: row.is_httponly === 1,
        expirationDate: chromeExpiryToUnix(row.expires_utc),
        sameSite: mapSameSite(row.samesite),
    };
    if (!isHostPrefixed)
        details.domain = row.host_key;
    return details;
}
function decryptCookieValue(plainValue, encryptedValue, hostKey, key) {
    const encrypted = toBuffer(encryptedValue);
    if (plainValue) {
        return {
            value: plainValue,
            debug: {
                source: 'plain_value',
                encryptedValue: bufferSnapshot(encrypted),
                decryptedValue: null,
                strippedValue: null,
                strippedHostHash: false,
            },
        };
    }
    if (!encrypted || !encrypted.length) {
        return {
            value: '',
            debug: {
                source: 'empty',
                encryptedValue: bufferSnapshot(encrypted),
                decryptedValue: null,
                strippedValue: null,
                strippedHostHash: false,
            },
        };
    }
    const decrypted = (0, chromeCrypto_1.decryptChromeValueBuffer)(encrypted, key);
    const stripped = stripChromeCookieHostHash(decrypted, hostKey);
    return {
        value: stripped.value.toString('utf8'),
        debug: {
            source: 'encrypted_value',
            encryptedValue: bufferSnapshot(encrypted),
            decryptedValue: bufferSnapshot(decrypted),
            strippedValue: bufferSnapshot(stripped.value),
            strippedHostHash: stripped.stripped,
        },
    };
}
async function readChromeCookies(profile, key, domainFilter, errors = []) {
    const cookiesPath = profile.cookiesPath ??
        [path.join(profile.path, 'Cookies'), path.join(profile.path, 'Network', 'Cookies')].find((candidate) => fs.existsSync(candidate));
    if (!cookiesPath)
        return { cookies: [], skipped: 0 };
    const db = openSqliteReadonly(cookiesPath);
    try {
        const rows = db
            .prepare(`SELECT host_key, name, value, encrypted_value, path, CAST(expires_utc AS TEXT) AS expires_utc, is_secure, is_httponly, samesite
         FROM cookies`)
            .all();
        const cookies = [];
        let skipped = 0;
        for (const row of rows) {
            if (!matchesDomainFilter(row.host_key, domainFilter))
                continue;
            try {
                const decoded = decryptCookieValue(row.value, row.encrypted_value, row.host_key, key);
                let value = decoded.value;
                if (!row.name)
                    continue;
                if (hasDisallowedCookieCharacters(value)) {
                    logCookieImportDebug('decode-disallowed-characters', row, {
                        row: cookieRowSnapshot(row),
                        decode: decoded.debug,
                        disallowedCharacters: getDisallowedCookieCharacters(value),
                        action: 'import-as-empty-value',
                    });
                    errors.push(`修正 Cookie (${row.name}@${row.host_key}): ${formatDisallowedCookieWarning(row, value)}`);
                    value = '';
                }
                const details = buildCookieDetails(row, value);
                if (decoded.debug.source !== 'empty' && value === '') {
                    logCookieImportDebug('prepared-empty-value-cookie', row, {
                        row: cookieRowSnapshot(row),
                        decode: decoded.debug,
                        details,
                    });
                }
                cookies.push(details);
            }
            catch (error) {
                skipped++;
                logCookieImportDebug('read-skip', row, {
                    row: cookieRowSnapshot(row),
                    error: error instanceof Error ? error.message : String(error),
                });
                errors.push(`跳过 Cookie (${row.name || '(unknown)'}@${row.host_key || '(unknown)'}): ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return { cookies, skipped };
    }
    finally {
        db.close();
    }
}
async function readChromePasswords(profile, key, domainFilter, errors = []) {
    const loginDataPath = path.join(profile.path, 'Login Data');
    if (!fs.existsSync(loginDataPath))
        return { passwords: [], skipped: 0 };
    const db = openSqliteReadonly(loginDataPath);
    try {
        const rows = db
            .prepare(`SELECT origin_url, username_value, password_value
         FROM logins
         WHERE origin_url IS NOT NULL AND origin_url != ''`)
            .all();
        const passwords = [];
        let skipped = 0;
        for (const row of rows) {
            if (domainFilter?.trim()) {
                try {
                    const hostname = new URL(row.origin_url).hostname.toLowerCase();
                    const filter = domainFilter.trim().toLowerCase().replace(/^\./, '');
                    if (hostname !== filter && !hostname.endsWith(`.${filter}`))
                        continue;
                }
                catch {
                    continue;
                }
            }
            try {
                const password = decryptField('', row.password_value, key);
                if (!password)
                    continue;
                passwords.push({
                    url: row.origin_url,
                    username: row.username_value ?? '',
                    password,
                });
            }
            catch (error) {
                skipped++;
                errors.push(`跳过密码 (${row.username_value || '(empty)'}@${row.origin_url || '(unknown)'}): ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return { passwords, skipped };
    }
    finally {
        db.close();
    }
}
function mergePasswords(existing, imported) {
    const keyOf = (entry) => `${entry.url}\0${entry.username}`;
    const seen = new Set(existing.map(keyOf));
    const merged = [...existing];
    let importedCount = 0;
    let skipped = 0;
    for (const entry of imported) {
        const key = keyOf(entry);
        if (seen.has(key)) {
            skipped++;
            continue;
        }
        seen.add(key);
        merged.push(entry);
        importedCount++;
    }
    return { merged, imported: importedCount, skipped };
}
async function applyChromeImport(options, setCookie, readStoredPasswords, writeStoredPasswords) {
    const profile = (0, chromeProfile_1.resolveChromeProfile)(options.profileId);
    if (!profile) {
        return {
            cookiesImported: 0,
            cookiesSkipped: 0,
            passwordsImported: 0,
            passwordsSkipped: 0,
            errors: ['未找到 Chrome 配置文件，请确认 Chrome 已安装'],
        };
    }
    const errors = [];
    const importCookies = options.importCookies !== false;
    const importPasswords = options.importPasswords !== false;
    const domainFilter = options.domainFilter;
    let key;
    try {
        key = await (0, chromeCrypto_1.getChromeDecryptionKey)(profile.path);
    }
    catch (error) {
        return {
            cookiesImported: 0,
            cookiesSkipped: 0,
            passwordsImported: 0,
            passwordsSkipped: 0,
            errors: [
                `无法读取 Chrome 解密密钥: ${error instanceof Error ? error.message : String(error)}`,
            ],
        };
    }
    let cookiesImported = 0;
    let cookiesSkipped = 0;
    let passwordsImported = 0;
    let passwordsSkipped = 0;
    if (importCookies && profile.hasCookies) {
        try {
            const { cookies, skipped } = await readChromeCookies(profile, key, domainFilter, errors);
            cookiesSkipped += skipped;
            for (const cookie of cookies) {
                try {
                    await setCookie(cookie);
                    cookiesImported++;
                }
                catch (error) {
                    cookiesSkipped++;
                    const hostname = cookie.domain ?? new URL(cookie.url).hostname;
                    errors.push(`写入 Cookie 失败 (${cookie.name}@${hostname}): ${error instanceof Error ? error.message : String(error)}`);
                }
            }
        }
        catch (error) {
            errors.push(`读取 Cookie 失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (importPasswords && profile.hasPasswords) {
        try {
            const { passwords, skipped } = await readChromePasswords(profile, key, domainFilter, errors);
            const existing = readStoredPasswords();
            const { merged, imported, skipped: mergedSkipped } = mergePasswords(existing, passwords);
            writeStoredPasswords(merged);
            passwordsImported = imported;
            passwordsSkipped = skipped + mergedSkipped;
        }
        catch (error) {
            errors.push(`读取密码失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    return {
        cookiesImported,
        cookiesSkipped,
        passwordsImported,
        passwordsSkipped,
        errors,
    };
}
