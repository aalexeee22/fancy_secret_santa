import ChristmasEmptyState from '../components/christmas/ChristmasEmptyState';
import { FestiveLink } from '../components/christmas/FestiveButton';
import { useI18n } from '../i18n/i18nContext';

/** Orice adresă care nu există: un spiriduș rătăcit și drumul spre casă. */
export default function NotFound() {
  const { notFound: tn } = useI18n().t;
  return (
    <div style={{ padding: '72px 16px', textAlign: 'center' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 'clamp(3rem, 12vw, 5.5rem)', fontWeight: 900, color: '#c0392b', lineHeight: 1 }}>
        404
      </div>
      <ChristmasEmptyState
        title={tn.title}
        description={tn.description}
        prop="🗺️"
        action={<FestiveLink to="/" gift="🏠">{tn.home}</FestiveLink>}
      />
    </div>
  );
}
