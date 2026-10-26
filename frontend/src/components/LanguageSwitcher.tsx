import { Dropdown } from 'antd';
import { LANGUAGES, isLang, useI18n } from '../i18n/i18nContext';

/** Butonul de limbă din navbar: arată codul limbii curente și deschide lista celorlalte. */
export default function LanguageSwitcher() {
  const { lang, setLang, t } = useI18n();

  return (
    <Dropdown
      trigger={['click']}
      placement="bottomRight"
      menu={{
        items: LANGUAGES.map(l => ({ key: l.code, label: <span lang={l.code}>{l.label}</span> })),
        selectable: true,
        selectedKeys: [lang],
        onClick: ({ key }) => { if (isLang(key)) setLang(key); },
      }}
    >
      <button type="button" className="xmas-theme-toggle xmas-lang-toggle" aria-label={t.nav.language} title={t.nav.language}>
        {lang.toUpperCase()}
      </button>
    </Dropdown>
  );
}
