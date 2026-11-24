import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/** Codul QR, generat în browser: nu trimitem linkul jocului la niciun serviciu extern. */
export default function DirtyQr({ value, size = 280, label }: { value: string; size?: number; label: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: 'M', color: { dark: '#111116', light: '#ffffff' } })
      .then(url => { if (active) setSrc(url); })
      .catch(() => { if (active) setSrc(null); });
    return () => { active = false; };
  }, [value, size]);

  return (
    <div className="dirty-qr" style={{ width: size, height: size }}>
      {src && <img src={src} alt={label} width={size} height={size} />}
    </div>
  );
}
