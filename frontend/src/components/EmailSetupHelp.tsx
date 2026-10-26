import { useI18n } from '../i18n/i18nContext';

// Ghidurile oficiale; pașii traduși stau în fișierele de limbă.
const GUIDE_URLS: Record<string, (lang: string) => string> = {
  gmail: lang => `https://support.google.com/accounts/answer/185833?hl=${lang}`,
  yahoo: () => 'https://help.yahoo.com/kb/SLN15241.html',
};

export default function EmailSetupHelp({ provider }: { provider: string }) {
  const { t, lang } = useI18n();
  const guide = t.emailHelp.guides[provider];
  const url = GUIDE_URLS[provider]?.(lang);
  if (!guide) return null;
  return <details key={provider} style={{ marginBottom: 20, padding: 14, background: '#f0f7ff', border: '1px solid #c6ddf5', borderRadius: 12, color: '#2c3e50', overflowWrap: 'anywhere' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>{t.emailHelp.summary}</summary>
    <ol style={{ paddingLeft: 22, marginTop: 12 }}>{guide.steps.map(step => <li key={step} style={{ marginBottom: 8 }}>{step}</li>)}</ol>
    {url && <a href={url} target="_blank" rel="noopener noreferrer">{t.emailHelp.officialGuide}</a>}
    <p style={{ marginTop: 12, marginBottom: 0 }}><strong>{t.emailHelp.stillNotWorking}</strong> {guide.troubleshoot}</p>
    <p style={{ marginTop: 10, marginBottom: 0 }}>{t.emailHelp.keepSecret}</p>
  </details>;
}
