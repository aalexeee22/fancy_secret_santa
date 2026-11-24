import { useCallback, useState } from 'react';
import { App } from 'antd';
import { makeDirtyMove, type DirtyAuth } from '../../api/client';
import type { DirtyGameState } from '../../types';
import { useI18n } from '../../i18n/i18nContext';
import type { SendMove } from './DirtyParts';

/**
 * Trimite o mutare cu versiunea pe care a văzut-o ecranul. Dacă între timp
 * s-a schimbat ceva (dublu-tap, altcineva a mutat), serverul răspunde 409 și
 * reîncărcăm starea în loc să repetăm mutarea.
 */
export function useSendMove(game: DirtyGameState | null, auth: DirtyAuth, accept: (g: DirtyGameState) => void, refresh: () => void) {
  const { message } = App.useApp();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);

  const send: SendMove = useCallback(async move => {
    if (!game || busy) return false;
    setBusy(true);
    try {
      accept(await makeDirtyMove(game.code, auth, { ...move, version: game.version }));
      return true;
    } catch (err: any) {
      message.error(err?.response?.data?.error || t.dirty.moveError);
      if (err?.response?.status === 409) refresh();
      return false;
    } finally {
      setBusy(false);
    }
  }, [game, busy, auth, accept, refresh, message, t]);

  return { send, busy };
}
