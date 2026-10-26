import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.DEV ? 'http://localhost:5000' : '',
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
