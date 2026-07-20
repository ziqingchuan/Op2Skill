import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

const CHROME_IMPORT_DEBUG = process.env.CHROME_IMPORT_DEBUG === '1'

export interface ChromeProfile {
  id: string
  name: string
  path: string
  cookiesPath?: string
  hasCookies: boolean
  hasPasswords: boolean
}

function getChromeUserDataDir(): string {
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library/Application Support/Google/Chrome')
  }
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData/Local')
    return path.join(localAppData, 'Google/Chrome/User Data')
  }
  return path.join(os.homedir(), '.config/google-chrome')
}

function readProfileDisplayName(profileDir: string, folderName: string): string {
  const prefsPath = path.join(profileDir, 'Preferences')
  if (!fs.existsSync(prefsPath)) return folderName

  try {
    const prefs = JSON.parse(fs.readFileSync(prefsPath, 'utf-8')) as {
      profile?: { name?: string }
    }
    return prefs.profile?.name?.trim() || folderName
  } catch {
    return folderName
  }
}

function resolveChromeCookiesPath(profileDir: string): string | null {
  const candidates = [
    path.join(profileDir, 'Cookies'),
    path.join(profileDir, 'Network', 'Cookies'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null
}

function logChromeProfileDiscovery(profiles: ChromeProfile[], userDataDir: string): void {
  if (!CHROME_IMPORT_DEBUG) return
  console.info('[chrome-import][profile-discovery]', {
    userDataDir,
    profiles: profiles.map((profile) => ({
      id: profile.id,
      path: profile.path,
      cookiesPath: profile.cookiesPath ?? null,
      hasCookies: profile.hasCookies,
      hasPasswords: profile.hasPasswords,
    })),
  })
}

export function listChromeProfiles(): ChromeProfile[] {
  const userDataDir = getChromeUserDataDir()
  if (!fs.existsSync(userDataDir)) return []

  const entries = fs.readdirSync(userDataDir, { withFileTypes: true })
  const profileFolders = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name === 'Default' || /^Profile \d+$/.test(name))

  const profiles: ChromeProfile[] = profileFolders.map((folderName) => {
    const profilePath = path.join(userDataDir, folderName)
    const cookiesPath = resolveChromeCookiesPath(profilePath)
    const loginDataPath = path.join(profilePath, 'Login Data')
    return {
      id: folderName,
      name: readProfileDisplayName(profilePath, folderName),
      path: profilePath,
      cookiesPath: cookiesPath ?? undefined,
      hasCookies: Boolean(cookiesPath),
      hasPasswords: fs.existsSync(loginDataPath),
    }
  })

  profiles.sort((a, b) => {
    if (a.id === 'Default') return -1
    if (b.id === 'Default') return 1
    return a.id.localeCompare(b.id, undefined, { numeric: true })
  })

  const result = profiles.filter((profile) => profile.hasCookies || profile.hasPasswords)
  logChromeProfileDiscovery(result, userDataDir)
  return result
}

export function resolveChromeProfile(profileId?: string): ChromeProfile | null {
  const profiles = listChromeProfiles()
  if (profiles.length === 0) return null
  if (!profileId) return profiles[0]
  return profiles.find((profile) => profile.id === profileId) ?? null
}
