import * as crypto from 'crypto'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { DatabaseSync } from 'node:sqlite'
import type { CookiesSetDetails } from 'electron'
import { decryptChromeValue, decryptChromeValueBuffer, getChromeDecryptionKey } from './chromeCrypto'
import { resolveChromeProfile, type ChromeProfile } from './chromeProfile'

export interface ImportedPassword {
  url: string
  username: string
  password: string
}

export interface ImportOptions {
  profileId?: string
  importCookies?: boolean
  importPasswords?: boolean
  domainFilter?: string
}

export interface ImportResult {
  cookiesImported: number
  cookiesSkipped: number
  passwordsImported: number
  passwordsSkipped: number
  errors: string[]
}

interface CookieRow {
  host_key: string
  name: string
  value: string
  encrypted_value: Buffer | Uint8Array | string | null
  path: string
  expires_utc: string | number | bigint | null
  is_secure: number
  is_httponly: number
  samesite: number
}

interface LoginRow {
  origin_url: string
  username_value: string
  password_value: Buffer | Uint8Array | string | null
}

interface CookieReadResult {
  cookies: CookiesSetDetails[]
  skipped: number
}

interface PasswordReadResult {
  passwords: ImportedPassword[]
  skipped: number
}

interface CookieDecodeDebug {
  source: 'plain_value' | 'encrypted_value' | 'empty'
  encryptedValue: Record<string, unknown> | null
  decryptedValue: Record<string, unknown> | null
  strippedValue: Record<string, unknown> | null
  strippedHostHash: boolean
}

interface CookieDecodeResult {
  value: string
  debug: CookieDecodeDebug
}

const CHROME_EPOCH_OFFSET = 11644473600n
const CHROME_IMPORT_DEBUG = process.env.CHROME_IMPORT_DEBUG === '1'

function makeTempDbPath(sourcePath: string): string {
  return path.join(
    os.tmpdir(),
    `op2skill-chrome-${path.basename(sourcePath)}-${Date.now()}.db`
  )
}

function openSqliteViaTempCopy(sourcePath: string): DatabaseSync {
  const tempPath = makeTempDbPath(sourcePath)
  fs.copyFileSync(sourcePath, tempPath)
  return new DatabaseSync(tempPath, { readOnly: true })
}

// Windows 上 fs.copyFileSync 底层走 CopyFileW，要求源文件未被独占锁定；
// Chrome 打开 Network\Cookies / Login Data 时持有独占锁，CopyFileW 会直接 EBUSY。
// fs.readFileSync/fs.open 走的是 CreateFileW，以更宽松的共享模式打开文件，
// 通常仍能在 Chrome 独占锁存在时读取到字节，所以改为手动读字节再写入临时文件。
function openSqliteViaRawReadCopy(sourcePath: string): DatabaseSync {
  const tempPath = makeTempDbPath(sourcePath)
  const data = fs.readFileSync(sourcePath)
  fs.writeFileSync(tempPath, data)
  return new DatabaseSync(tempPath, { readOnly: true })
}

function openSqliteReadonly(sourcePath: string): DatabaseSync {
  // macOS: Chrome 常驻后台会对 Cookies/Login Data 持有共享锁，直接只读打开在锁存在时
  // 会成功但读取时报 "database is locked"；复制到临时文件再打开可以绕开这个锁，
  // 这是 mac 上原本验证稳定的行为，不要改回"先直接打开"。
  if (process.platform === 'darwin') {
    return openSqliteViaTempCopy(sourcePath)
  }

  // Windows: 依次尝试 直接只读打开 → copyFileSync 复制 → 原始字节读写复制，
  // 覆盖 Chrome 独占锁导致 CopyFileW 失败（EBUSY）的场景。
  try {
    return new DatabaseSync(sourcePath, { readOnly: true })
  } catch {
    try {
      return openSqliteViaTempCopy(sourcePath)
    } catch {
      return openSqliteViaRawReadCopy(sourcePath)
    }
  }
}

function chromeExpiryToUnix(expiresUtc: CookieRow['expires_utc']): number | undefined {
  if (expiresUtc == null || expiresUtc === '' || expiresUtc === 0 || expiresUtc === 0n) return undefined

  const chromeMicros = typeof expiresUtc === 'bigint'
    ? expiresUtc
    : BigInt(String(expiresUtc))
  if (chromeMicros <= 0n) return undefined

  const unixSeconds = chromeMicros / 1_000_000n - CHROME_EPOCH_OFFSET
  if (unixSeconds <= 0n || unixSeconds > BigInt(Number.MAX_SAFE_INTEGER)) return undefined
  return Number(unixSeconds)
}

function cookieUrl(hostKey: string, pathValue: string, secure: boolean): string {
  const host = hostKey.startsWith('.') ? hostKey.slice(1) : hostKey
  const scheme = secure ? 'https' : 'http'
  const normalizedPath = pathValue.startsWith('/') ? pathValue : `/${pathValue}`
  return `${scheme}://${host}${normalizedPath}`
}

function mapSameSite(value: number): CookiesSetDetails['sameSite'] {
  switch (value) {
    case 0:
      return 'no_restriction'
    case 1:
      return 'lax'
    case 2:
      return 'strict'
    default:
      return 'unspecified'
  }
}

function matchesDomainFilter(hostKey: string, domainFilter?: string): boolean {
  if (!domainFilter?.trim()) return true
  const filter = domainFilter.trim().toLowerCase().replace(/^\./, '')
  const host = hostKey.toLowerCase().replace(/^\./, '')
  return host === filter || host.endsWith(`.${filter}`)
}

function toBuffer(value: Buffer | Uint8Array | string | null | undefined): Buffer | null {
  if (value == null) return null
  if (Buffer.isBuffer(value)) return value
  if (value instanceof Uint8Array) return Buffer.from(value)
  if (typeof value === 'string') return Buffer.from(value, 'binary')
  return null
}

function decryptField(
  plainValue: string,
  encryptedValue: Buffer | Uint8Array | string | null | undefined,
  key: Buffer
): string {
  if (plainValue) return plainValue
  const encrypted = toBuffer(encryptedValue)
  if (!encrypted || !encrypted.length) return ''
  return decryptChromeValue(encrypted, key)
}

function hasAsciiControlCharacters(value: Buffer): boolean {
  return value.some((byte) => byte < 0x20 || byte === 0x7f)
}

function getDisallowedCookieCharacters(value: string): string[] {
  const chars: string[] = []
  for (let index = 0; index < value.length; index++) {
    const code = value.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) {
      chars.push(`index=${index}, code=0x${code.toString(16).padStart(2, '0')}`)
    }
  }
  return chars
}

function hasDisallowedCookieCharacters(value: string): boolean {
  return getDisallowedCookieCharacters(value).length > 0
}

function formatOriginalCookie(row: CookieRow, value: string): string {
  return JSON.stringify({
    name: row.name,
    domain: row.host_key,
    path: row.path || '/',
    secure: row.is_secure === 1,
    httpOnly: row.is_httponly === 1,
    sameSite: mapSameSite(row.samesite),
    expiresUtc: row.expires_utc,
    value,
  })
}

function formatDisallowedCookieWarning(row: CookieRow, value: string): string {
  const chars = getDisallowedCookieCharacters(value)
  return `Cookie value 解密结果包含 Chromium 不允许的 ASCII 控制字符 (${chars.join('; ')})，与浏览器 DevTools 常见空值显示不一致；已按空值导入。解密结果快照: ${formatOriginalCookie(row, value)}`
}

function bufferSnapshot(value: Buffer | null): Record<string, unknown> | null {
  if (!value) return null
  return {
    length: value.length,
    hexHead: value.subarray(0, 64).toString('hex'),
    base64: value.toString('base64'),
    utf8Json: JSON.stringify(value.toString('utf8')),
  }
}

function cookieRowSnapshot(row: CookieRow): Record<string, unknown> {
  const encrypted = toBuffer(row.encrypted_value)
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
  }
}

function logCookieImportDebug(stage: string, row: CookieRow, payload: Record<string, unknown>): void {
  if (!CHROME_IMPORT_DEBUG) return
  console.info(`[chrome-import][cookie][${row.name}@${row.host_key}][${stage}]`, payload)
}

function stripChromeCookieHostHash(value: Buffer, hostKey: string): { value: Buffer; stripped: boolean } {
  if (value.length < 32) return { value, stripped: false }

  const hostVariants = new Set([hostKey, hostKey.replace(/^\./, '')])
  for (const host of hostVariants) {
    const hostHash = crypto.createHash('sha256').update(host).digest()
    if (value.subarray(0, 32).equals(hostHash)) {
      return { value: value.subarray(32), stripped: true }
    }
  }

  if (!hasAsciiControlCharacters(value)) return { value, stripped: false }

  for (let offset = 32; offset <= Math.min(64, value.length - 1); offset++) {
    const strippedValue = value.subarray(offset)
    if (strippedValue.length > 0 && !hasAsciiControlCharacters(strippedValue)) {
      return { value: strippedValue, stripped: true }
    }
  }

  return { value, stripped: false }
}

function buildCookieDetails(row: CookieRow, value: string): CookiesSetDetails {
  const isHostPrefixed = row.name.startsWith('__Host-')
  const isSecurePrefixed = isHostPrefixed || row.name.startsWith('__Secure-')
  const secure = row.is_secure === 1 || isSecurePrefixed
  const details: CookiesSetDetails = {
    url: cookieUrl(row.host_key, isHostPrefixed ? '/' : row.path, secure),
    name: row.name,
    value,
    path: isHostPrefixed ? '/' : row.path || '/',
    secure,
    httpOnly: row.is_httponly === 1,
    expirationDate: chromeExpiryToUnix(row.expires_utc),
    sameSite: mapSameSite(row.samesite),
  }

  if (!isHostPrefixed) details.domain = row.host_key
  return details
}

function decryptCookieValue(
  plainValue: string,
  encryptedValue: Buffer | Uint8Array | string | null | undefined,
  hostKey: string,
  key: Buffer
): CookieDecodeResult {
  const encrypted = toBuffer(encryptedValue)
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
    }
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
    }
  }

  const decrypted = decryptChromeValueBuffer(encrypted, key)
  const stripped = stripChromeCookieHostHash(decrypted, hostKey)
  return {
    value: stripped.value.toString('utf8'),
    debug: {
      source: 'encrypted_value',
      encryptedValue: bufferSnapshot(encrypted),
      decryptedValue: bufferSnapshot(decrypted),
      strippedValue: bufferSnapshot(stripped.value),
      strippedHostHash: stripped.stripped,
    },
  }
}

export async function readChromeCookies(
  profile: ChromeProfile,
  key: Buffer,
  domainFilter?: string,
  errors: string[] = []
): Promise<CookieReadResult> {
  const cookiesPath =
    profile.cookiesPath ??
    [path.join(profile.path, 'Cookies'), path.join(profile.path, 'Network', 'Cookies')].find((candidate) =>
      fs.existsSync(candidate)
    )
  if (!cookiesPath) return { cookies: [], skipped: 0 }

  const db = openSqliteReadonly(cookiesPath)
  try {
    const rows = db
      .prepare(
        `SELECT host_key, name, value, encrypted_value, path, CAST(expires_utc AS TEXT) AS expires_utc, is_secure, is_httponly, samesite
         FROM cookies`
      )
      .all() as unknown as CookieRow[]

    const cookies: CookiesSetDetails[] = []
    let skipped = 0
    for (const row of rows) {
      if (!matchesDomainFilter(row.host_key, domainFilter)) continue

      try {
        const decoded = decryptCookieValue(row.value, row.encrypted_value, row.host_key, key)
        let value = decoded.value
        if (!row.name) continue
        if (hasDisallowedCookieCharacters(value)) {
          logCookieImportDebug('decode-disallowed-characters', row, {
            row: cookieRowSnapshot(row),
            decode: decoded.debug,
            disallowedCharacters: getDisallowedCookieCharacters(value),
            action: 'import-as-empty-value',
          })
          errors.push(`修正 Cookie (${row.name}@${row.host_key}): ${formatDisallowedCookieWarning(row, value)}`)
          value = ''
        }

        const details = buildCookieDetails(row, value)
        if (decoded.debug.source !== 'empty' && value === '') {
          logCookieImportDebug('prepared-empty-value-cookie', row, {
            row: cookieRowSnapshot(row),
            decode: decoded.debug,
            details,
          })
        }
        cookies.push(details)
      } catch (error) {
        skipped++
        logCookieImportDebug('read-skip', row, {
          row: cookieRowSnapshot(row),
          error: error instanceof Error ? error.message : String(error),
        })
        errors.push(
          `跳过 Cookie (${row.name || '(unknown)'}@${row.host_key || '(unknown)'}): ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
    return { cookies, skipped }
  } finally {
    db.close()
  }
}

export async function readChromePasswords(
  profile: ChromeProfile,
  key: Buffer,
  domainFilter?: string,
  errors: string[] = []
): Promise<PasswordReadResult> {
  const loginDataPath = path.join(profile.path, 'Login Data')
  if (!fs.existsSync(loginDataPath)) return { passwords: [], skipped: 0 }

  const db = openSqliteReadonly(loginDataPath)
  try {
    const rows = db
      .prepare(
        `SELECT origin_url, username_value, password_value
         FROM logins
         WHERE origin_url IS NOT NULL AND origin_url != ''`
      )
      .all() as unknown as LoginRow[]

    const passwords: ImportedPassword[] = []
    let skipped = 0
    for (const row of rows) {
      if (domainFilter?.trim()) {
        try {
          const hostname = new URL(row.origin_url).hostname.toLowerCase()
          const filter = domainFilter.trim().toLowerCase().replace(/^\./, '')
          if (hostname !== filter && !hostname.endsWith(`.${filter}`)) continue
        } catch {
          continue
        }
      }

      try {
        const password = decryptField('', row.password_value, key)
        if (!password) continue

        passwords.push({
          url: row.origin_url,
          username: row.username_value ?? '',
          password,
        })
      } catch (error) {
        skipped++
        errors.push(
          `跳过密码 (${row.username_value || '(empty)'}@${row.origin_url || '(unknown)'}): ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
    return { passwords, skipped }
  } finally {
    db.close()
  }
}

export function mergePasswords(
  existing: ImportedPassword[],
  imported: ImportedPassword[]
): { merged: ImportedPassword[]; imported: number; skipped: number } {
  const keyOf = (entry: ImportedPassword) => `${entry.url}\0${entry.username}`
  const seen = new Set(existing.map(keyOf))
  const merged = [...existing]
  let importedCount = 0
  let skipped = 0

  for (const entry of imported) {
    const key = keyOf(entry)
    if (seen.has(key)) {
      skipped++
      continue
    }
    seen.add(key)
    merged.push(entry)
    importedCount++
  }

  return { merged, imported: importedCount, skipped }
}

export async function applyChromeImport(
  options: ImportOptions,
  setCookie: (details: CookiesSetDetails) => Promise<void>,
  readStoredPasswords: () => ImportedPassword[],
  writeStoredPasswords: (entries: ImportedPassword[]) => void
): Promise<ImportResult> {
  const profile = resolveChromeProfile(options.profileId)
  if (!profile) {
    return {
      cookiesImported: 0,
      cookiesSkipped: 0,
      passwordsImported: 0,
      passwordsSkipped: 0,
      errors: ['未找到 Chrome 配置文件，请确认 Chrome 已安装'],
    }
  }

  const errors: string[] = []
  const importCookies = options.importCookies !== false
  const importPasswords = options.importPasswords !== false
  const domainFilter = options.domainFilter

  let key: Buffer
  try {
    key = await getChromeDecryptionKey(profile.path)
  } catch (error) {
    return {
      cookiesImported: 0,
      cookiesSkipped: 0,
      passwordsImported: 0,
      passwordsSkipped: 0,
      errors: [
        `无法读取 Chrome 解密密钥: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
  let cookiesImported = 0
  let cookiesSkipped = 0
  let passwordsImported = 0
  let passwordsSkipped = 0

  if (importCookies && profile.hasCookies) {
    try {
      const { cookies, skipped } = await readChromeCookies(profile, key, domainFilter, errors)
      cookiesSkipped += skipped
      for (const cookie of cookies) {
        try {
          await setCookie(cookie)
          cookiesImported++
        } catch (error) {
          cookiesSkipped++
          const hostname = cookie.domain ?? new URL(cookie.url).hostname
          errors.push(
            `写入 Cookie 失败 (${cookie.name}@${hostname}): ${
              error instanceof Error ? error.message : String(error)
            }`
          )
        }
      }
    } catch (error) {
      errors.push(`读取 Cookie 失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (importPasswords && profile.hasPasswords) {
    try {
      const { passwords, skipped } = await readChromePasswords(profile, key, domainFilter, errors)
      const existing = readStoredPasswords()
      const { merged, imported, skipped: mergedSkipped } = mergePasswords(existing, passwords)
      writeStoredPasswords(merged)
      passwordsImported = imported
      passwordsSkipped = skipped + mergedSkipped
    } catch (error) {
      errors.push(`读取密码失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return {
    cookiesImported,
    cookiesSkipped,
    passwordsImported,
    passwordsSkipped,
    errors,
  }
}
