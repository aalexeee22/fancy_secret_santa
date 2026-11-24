/**
 * Ce ține minte dispozitivul despre jocurile Dirty Santa, fără conturi.
 *
 * dirty-santa:game:<COD>  → tokenurile pentru jocul ăla (jucător și/sau ecranul mare)
 * dirty-santa:current     → codul jocului în desfășurare, pentru „Revino în joc”
 *
 * Tokenurile nu expiră pe dispozitiv: serverul șterge jocul după petrecere,
 * iar la primul 404 dispozitivul își curăță singur datele.
 */
export interface StoredDirtyGame {
  code: string;
  hostToken?: string;
  playerToken?: string;
  playerId?: number;
  nickname?: string;
}

const GAME_PREFIX = 'dirty-santa:game:';
const CURRENT_KEY = 'dirty-santa:current';

/** „xmas 24” și „XMAS-24” sunt același cod, ca pe server. */
export const normalizeCode = (code: string) => code.replace(/[\s-]/g, '').toUpperCase().slice(0, 12);

export function readStoredGame(code: string): StoredDirtyGame | null {
  try {
    const raw = JSON.parse(localStorage.getItem(GAME_PREFIX + normalizeCode(code)) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    return {
      code: normalizeCode(code),
      hostToken: typeof raw.hostToken === 'string' ? raw.hostToken : undefined,
      playerToken: typeof raw.playerToken === 'string' ? raw.playerToken : undefined,
      playerId: typeof raw.playerId === 'number' ? raw.playerId : undefined,
      nickname: typeof raw.nickname === 'string' ? raw.nickname : undefined,
    };
  } catch {
    return null;
  }
}

export function saveStoredGame(code: string, patch: Partial<StoredDirtyGame>): StoredDirtyGame {
  const merged = { ...readStoredGame(code), ...patch, code: normalizeCode(code) };
  try {
    localStorage.setItem(GAME_PREFIX + merged.code, JSON.stringify(merged));
  } catch {
    // Fără localStorage (mod privat strict), jocul merge până la primul refresh.
  }
  return merged;
}

export function forgetStoredGame(code: string) {
  try {
    localStorage.removeItem(GAME_PREFIX + normalizeCode(code));
    if (readCurrentGame() === normalizeCode(code)) localStorage.removeItem(CURRENT_KEY);
  } catch {
    // nimic de curățat
  }
}

export function readCurrentGame(): string | null {
  try {
    const code = localStorage.getItem(CURRENT_KEY);
    return code ? normalizeCode(code) : null;
  } catch {
    return null;
  }
}

export function setCurrentGame(code: string | null) {
  try {
    if (code) localStorage.setItem(CURRENT_KEY, normalizeCode(code));
    else localStorage.removeItem(CURRENT_KEY);
  } catch {
    // fără „Revino în joc”, dar linkul jocului merge în continuare
  }
}
