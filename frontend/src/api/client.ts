import axios from 'axios';
import type { AdventCalendar, DirtyGameInfo, DirtyGameState, DirtyJoinResult, DirtyMoveKind } from '../types';

const API_BASE = import.meta.env.DEV ? 'http://localhost:5000' : '';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
  // Mereu de la server: /api/admin are aceeași adresă pentru toate grupurile, iar un
  // răspuns „expirat” păstrat de browser de la un grup vechi ar ascunde grupul nou.
  adapter: 'fetch',
  fetchOptions: { cache: 'no-store' },
});

/** Limba în care serverul scrie mesajele de eroare și emailurile. */
export const setApiLanguage = (lang: string) => {
  api.defaults.headers.common['Accept-Language'] = lang;
};

export const createGroup = (data: {
  name: string;
  budget?: number;
  smtp_provider?: string;
  smtp_email?: string;
  smtp_password?: string;
}) => api.post('/api/groups', data).then(r => r.data);

export const getGroup = (code: string) =>
  api.get(`/api/groups/${code}`).then(r => r.data);

// Codul de admin merge în header, nu în URL, ca să nu apară în logurile serverului.
const adminHeaders = (adminCode: string) => ({ headers: { 'X-Admin-Code': adminCode } });

export const getAdminGroup = (adminCode: string) =>
  api.get('/api/admin', adminHeaders(adminCode)).then(r => r.data);

export const drawNames = (adminCode: string) =>
  api.post('/api/admin/draw', null, adminHeaders(adminCode)).then(r => r.data);

export const resendEmails = (adminCode: string, smtpPassword?: string, retryUncertain = false) =>
  api.post('/api/admin/resend', { smtp_password: smtpPassword || undefined, retry_uncertain: retryUncertain }, adminHeaders(adminCode)).then(r => r.data);

export const deleteParticipant = (adminCode: string, participantId: number) =>
  api.delete(`/api/admin/participants/${participantId}`, adminHeaders(adminCode)).then(r => r.data);

export const addParticipant = (code: string, data: {
  name: string;
  email: string;
  wishlist?: string;
}) => api.post(`/api/groups/${code}/participants`, data).then(r => r.data);

export const getStats = () =>
  api.get('/api/stats').then(r => r.data);

export const getEmailConfig = () =>
  api.get<{ blocked_smtp_ports: number[]; unavailable_providers: string[] }>('/api/config').then(r => r.data);

// Calendarul cu filme de Crăciun: serverul decide ce zi e.

export const getAdvent = () =>
  api.get<AdventCalendar>('/api/advent').then(r => r.data);

export const adventPosterUrl = (door: number) =>
  `${API_BASE}/api/advent/${door}/poster`;

// Dirty Santa: tokenurile merg în header, nu în URL, ca să nu apară în loguri.

export interface DirtyAuth {
  hostToken?: string;
  playerToken?: string;
}

const dirtyHeaders = (auth: DirtyAuth) => ({
  headers: auth.hostToken ? { 'X-Host-Token': auth.hostToken } : { 'X-Player-Token': auth.playerToken ?? '' },
});

export const createDirtyGame = (data: { steal_limit: number; final_round: boolean; budget?: number }) =>
  api.post<{ code: string; host_token: string }>('/api/dirty', data).then(r => r.data);

export const getDirtyInfo = (code: string) =>
  api.get<DirtyGameInfo>(`/api/dirty/${encodeURIComponent(code)}/info`).then(r => r.data);

export const joinDirtyGame = (code: string, nickname: string) =>
  api.post<DirtyJoinResult>(`/api/dirty/${encodeURIComponent(code)}/join`, { nickname }).then(r => r.data);

/** null = nimic nou față de versiunea `since`. */
export const getDirtyGame = (code: string, auth: DirtyAuth, since?: number) =>
  api.get<DirtyGameState | ''>(`/api/dirty/${encodeURIComponent(code)}`, {
    ...dirtyHeaders(auth),
    params: since == null ? undefined : { since },
  }).then(r => (r.status === 204 || !r.data ? null : r.data));

export const startDirtyGame = (code: string, auth: DirtyAuth) =>
  api.post<DirtyGameState>(`/api/dirty/${encodeURIComponent(code)}/start`, null, dirtyHeaders(auth)).then(r => r.data);

export const makeDirtyMove = (code: string, auth: DirtyAuth, move: {
  kind: DirtyMoveKind;
  version: number;
  gift_id?: number;
}) => api.post<DirtyGameState>(`/api/dirty/${encodeURIComponent(code)}/move`, move, dirtyHeaders(auth)).then(r => r.data);

export const undoDirtyMove = (code: string, auth: DirtyAuth, version: number) =>
  api.post<DirtyGameState>(`/api/dirty/${encodeURIComponent(code)}/undo`, { version }, dirtyHeaders(auth)).then(r => r.data);

export const addDirtyPlayer = (code: string, auth: DirtyAuth, nickname: string) =>
  api.post<DirtyGameState>(`/api/dirty/${encodeURIComponent(code)}/players`, { nickname }, dirtyHeaders(auth)).then(r => r.data);

export const removeDirtyPlayer = (code: string, auth: DirtyAuth, playerId: number) =>
  api.delete<DirtyGameState>(`/api/dirty/${encodeURIComponent(code)}/players/${playerId}`, dirtyHeaders(auth)).then(r => r.data);

export const reconnectDirtyPlayer = (code: string, auth: DirtyAuth, playerId: number) =>
  api.post<DirtyJoinResult>(`/api/dirty/${encodeURIComponent(code)}/players/${playerId}/reconnect`, null, dirtyHeaders(auth)).then(r => r.data);
