const GUIDES: Record<string, { steps: string[]; url: string; troubleshoot: string }> = {
  gmail: {
    steps: [
      'În contul Google, activează verificarea în doi pași (2-Step Verification).',
      'Deschide pagina App passwords, denumește aplicația „Secret Santa” și generează o parolă.',
      'Copiază codul de 16 caractere aici, fără spațiile de grupare. Nu folosi parola contului sau codul primit prin SMS.',
    ],
    url: 'https://support.google.com/accounts/answer/185833?hl=ro',
    troubleshoot: 'Nu apare App passwords? Conturile de serviciu/școală, Advanced Protection sau verificarea doar cu chei de securitate pot avea restricții. Întreabă administratorul contului.',
  },
  yahoo: {
    steps: [
      'Deschide Yahoo Account Security din contul tău.',
      'La External connections, alege Create app password. Scrie „Secret Santa” și generează parola.',
      'Copiază parola generată în câmpul de mai jos; nu folosi parola cu care intri pe Yahoo.',
    ],
    url: 'https://help.yahoo.com/kb/SLN15241.html',
    troubleshoot: 'Yahoo poate limita generarea parolelor de aplicație. Încearcă din browserul în care folosești deja contul de câteva zile, fără modul incognito. Dacă opțiunea lipsește, verifică ajutorul oficial.',
  },
};

export default function EmailSetupHelp({ provider }: { provider: string }) {
  const guide = GUIDES[provider];
  if (!guide) return null;
  return <details key={provider} style={{ marginBottom: 20, padding: 14, background: '#f0f7ff', border: '1px solid #c6ddf5', borderRadius: 12, color: '#2c3e50', overflowWrap: 'anywhere' }}>
    <summary style={{ cursor: 'pointer', fontWeight: 600 }}>ⓘ Cum obțin parola pentru trimiterea emailurilor?</summary>
    <ol style={{ paddingLeft: 22, marginTop: 12 }}>{guide.steps.map(step => <li key={step} style={{ marginBottom: 8 }}>{step}</li>)}</ol>
    {guide.url && <a href={guide.url} target="_blank" rel="noopener noreferrer">Deschide ghidul oficial ↗</a>}
    <p style={{ marginTop: 12, marginBottom: 0 }}><strong>Tot nu merge?</strong> {guide.troubleshoot}</p>
    <p style={{ marginTop: 10, marginBottom: 0 }}>Parola de aplicație permite accesul la email. Păstreaz-o secretă și revoc-o din contul furnizorului când nu mai ai nevoie de ea.</p>
  </details>;
}
