import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, App, Modal, Segmented, Spin } from 'antd';
import { adventPosterUrl, getAdvent } from '../api/client';
import type { AdventCalendar, AdventDoor, AdventMovie } from '../types';
import { useChristmasConfetti } from '../components/christmas/confettiContext';
import { useXmasTheme } from '../components/christmas/themeContext';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { useI18n } from '../i18n/i18nContext';
import doorClosed from '../assets/advent/door-closed.webp';
import doorOpen from '../assets/advent/door-open.webp';
import padlock from '../assets/advent/padlock.webp';
import '../styles/advent.css';

const OPENED_KEY = 'advent-opened-days';
const VIEW_KEY = 'advent-view';
// Sub lățimea asta, modul implicit e cel compact.
const COMPACT_QUERY = '(max-width: 700px)';
const OPEN_ANIMATION_MS = 900;
const LAST_DAY = 25;

// Ordinea amestecată a ușițelor, ca la un calendar adevărat, dar mereu aceeași.
const SHUFFLED_DAYS = (() => {
  const days = Array.from({ length: LAST_DAY }, (_, i) => i + 1);
  let seed = 2026;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = days.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [days[i], days[j]] = [days[j], days[i]];
  }
  return days;
})();

const PLATFORMS: [string, string][] = [
  ['netflix.com', 'Netflix'],
  ['disneyplus.com', 'Disney+'],
  ['youtube.com', 'YouTube'],
  ['youtu.be', 'YouTube'],
  ['primevideo.com', 'Prime Video'],
  ['hbomax.com', 'HBO Max'],
  ['max.com', 'HBO Max'],
  ['tv.apple.com', 'Apple TV'],
  ['voyo.protv.ro', 'Voyo'],
  ['cinemagia.ro', 'Cinemagia'],
];

function platformOf(url?: string) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return PLATFORMS.find(([domain]) => host === domain || host.endsWith(`.${domain}`))?.[1] ?? host;
  } catch {
    return null;
  }
}

type ViewMode = 'calendar' | 'compact';

function readView(): ViewMode | null {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    return value === 'calendar' || value === 'compact' ? value : null;
  } catch {
    return null;
  }
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** Doar linkuri https: datele vin din baza de date, dar nu lăsăm alte scheme în href. */
const safeLink = (url?: string) => (url && url.startsWith('https://') ? url : undefined);

function readOpened(): Set<number> {
  try {
    const raw = JSON.parse(localStorage.getItem(OPENED_KEY) ?? '[]');
    return new Set(Array.isArray(raw) ? raw.filter((d): d is number => typeof d === 'number') : []);
  } catch {
    return new Set();
  }
}

function saveOpened(days: Set<number>) {
  try {
    localStorage.setItem(OPENED_KEY, JSON.stringify([...days]));
  } catch {
    // Fără localStorage, ușița de azi se închide la loc după refresh; nimic grav.
  }
}

export default function Advent() {

  const { t, locale } = useI18n();
  const ta = t.advent;
  const { message } = App.useApp();
  const fireConfetti = useChristmasConfetti();
  const reducedMotion = useReducedMotion();

  const [calendar, setCalendar] = useState<AdventCalendar | null>(null);
  const [error, setError] = useState(false);
  const [opened, setOpened] = useState<Set<number>>(() => readOpened());
  const [opening, setOpening] = useState<number | null>(null);
  const [shaking, setShaking] = useState<number | null>(null);
  const [shown, setShown] = useState<AdventDoor | null>(null);
  const timers = useRef<number[]>([]);
  const featuredRef = useRef<HTMLDivElement>(null);

  // Implicit: calendarul pe ecrane mari, compact pe telefon; alegerea manuală e ținută minte.
  const smallScreen = useMediaQuery(COMPACT_QUERY);
  const [chosenView, setChosenView] = useState<ViewMode | null>(() => readView());
  const view: ViewMode = chosenView ?? (smallScreen ? 'compact' : 'calendar');
  const changeView = (next: ViewMode) => {
    setChosenView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Fără localStorage, alegerea ține doar până la refresh.
    }
  };

  useEffect(() => {
    let active = true;
    setCalendar(null);
    setError(false);
    getAdvent()
      .then(data => { if (active) setCalendar(data); })
      .catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  // Pagina nu folosește parametri: îi scoatem din bara de adresă, ca linkul să rămână curat (/advent).
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (location.search) navigate({ pathname: location.pathname, hash: location.hash }, { replace: true });
  }, [location.search, location.pathname, location.hash, navigate]);

  const isOpened = useCallback((day: number) => opened.has(day), [opened]);

  const formatDay = useCallback(
    (day: number) => new Date(2026, 11, day).toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
    [locale],
  );

  const doorsByDay = useMemo(() => new Map(calendar?.doors.map(d => [d.day, d]) ?? []), [calendar]);
  const bonus = doorsByDay.get(26);
  // Ușița bonus apare abia după ce s-a deschis ușița 25.
  const showBonus = Boolean(bonus) && (calendar!.today !== LAST_DAY || isOpened(LAST_DAY));
  const orderedDoors = useMemo(
    () => (calendar?.doors ?? []).filter(d => !d.bonus || showBonus),
    [calendar, showBonus],
  );
  // Ușa mare din modul compact: cea de azi; înainte de 1 decembrie ușa 1, după sărbători ultima.
  const featured = orderedDoors.find(d => d.state === 'today')
    ?? (calendar?.today === 0 ? orderedDoors[0] : orderedDoors[orderedDoors.length - 1]);

  const openToday = (door: AdventDoor) => {
    if (opening !== null) return;
    const finish = () => {
      setOpening(null);
      setOpened(prev => {
        const next = new Set(prev).add(door.day);
        saveOpened(next);
        return next;
      });
      if (!reducedMotion) fireConfetti({ y: 45 });
      setShown(door);
      if (door.day === LAST_DAY && bonus) {
        timers.current.push(window.setTimeout(() => message.success(ta.bonusAppeared, 5), 600));
      }
    };
    if (reducedMotion) {
      finish();
      return;
    }
    setOpening(door.day);
    timers.current.push(window.setTimeout(finish, OPEN_ANIMATION_MS));
  };

  const shakeLocked = (door: AdventDoor) => {
    setShaking(door.day);
    timers.current.push(window.setTimeout(() => setShaking(s => (s === door.day ? null : s)), 600));
    message.info(door.bonus ? ta.bonusTomorrow : ta.locked(formatDay(door.day)));
  };

  const handleClick = (door: AdventDoor) => {
    if (door.state === 'locked') shakeLocked(door);
    else if (door.state === 'today' && !isOpened(door.day)) openToday(door);
    else setShown(door);
  };

  // În modul compact, plăcuța de azi deschide ușa mare: o aducem întâi în ecran.
  const handleTileClick = (door: AdventDoor) => {
    if (door.state === 'today' && !isOpened(door.day) && featuredRef.current) {
      const rect = featuredRef.current.getBoundingClientRect();
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        featuredRef.current.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
        timers.current.push(window.setTimeout(() => openToday(door), reducedMotion ? 0 : 450));
        return;
      }
    }
    handleClick(door);
  };

  const visualOf = (door: AdventDoor) => {
    const isOpenNow = door.state === 'open' || (door.state === 'today' && isOpened(door.day));
    return opening === door.day ? 'opening' : isOpenNow ? 'open' : door.state;
  };

  const labelOf = (door: AdventDoor, visual: string) => (door.state === 'locked' ? ta.doorLocked(door.day)
    : visual === 'today' ? ta.doorToday(door.day) : ta.doorOpen(door.day));

  const renderTile = (door: AdventDoor) => {
    const visual = visualOf(door);
    const showPoster = (visual === 'open' || visual === 'opening') && door.movie?.has_poster;
    return (
      <button
        key={door.day}
        type="button"
        className={[
          'advent-tile',
          `advent-tile--${visual}`,
          door.bonus ? 'advent-tile--bonus' : '',
          shaking === door.day ? 'advent-door--shake' : '',
        ].filter(Boolean).join(' ')}
        onClick={() => handleTileClick(door)}
        aria-label={labelOf(door, visual)}
        title={door.movie && showPoster ? door.movie.title : undefined}
      >
        {showPoster && <img className="advent-tile__poster" src={adventPosterUrl(door.day)} alt="" loading="lazy" />}
        <span className="advent-tile__number" aria-hidden="true">{door.bonus ? '🎁' : door.day}</span>
        {door.state === 'locked' && <img className="advent-tile__padlock" src={padlock} alt="" draggable={false} />}
      </button>
    );
  };

  const renderDoor = (door: AdventDoor, extraClass = '') => {
    const visual = visualOf(door);
    const label = labelOf(door, visual);
    const showInside = visual === 'open' || visual === 'opening';
    return (
      <button
        key={door.day}
        type="button"
        className={[
          'advent-door',
          `advent-door--${visual}`,
          door.bonus ? 'advent-door--bonus' : '',
          door.day === LAST_DAY ? 'advent-door--christmas' : '',
          shaking === door.day ? 'advent-door--shake' : '',
          extraClass,
        ].filter(Boolean).join(' ')}
        onClick={() => handleClick(door)}
        aria-label={label}
        title={door.movie && showInside ? door.movie.title : undefined}
      >
        {showInside && (
          <span className="advent-door__inside">
            {door.movie?.has_poster ? (
              <img src={adventPosterUrl(door.day)} alt="" loading="lazy" />
            ) : (
              <span className="advent-door__placeholder" aria-hidden="true">🎬</span>
            )}
          </span>
        )}
        {showInside && <img className="advent-door__frame" src={doorOpen} alt="" draggable={false} />}
        {visual !== 'open' && (
          <span className="advent-door__leaf">
            <img src={doorClosed} alt="" draggable={false} />
            <span className="advent-door__number" aria-hidden="true">{door.bonus ? '🎁' : door.day}</span>
          </span>
        )}
        {door.state === 'locked' && <img className="advent-door__padlock" src={padlock} alt="" draggable={false} />}
        {door.bonus && <span className="advent-door__ribbon">{ta.bonus}</span>}
      </button>
    );
  };

  return (
    <div className="advent-page">
      <header className="advent-header">
        <h1>{ta.title}</h1>
        <p>{ta.subtitle}</p>
        <Segmented<ViewMode>
          className="advent-view-switch"
          aria-label={ta.viewLabel}
          value={view}
          onChange={changeView}
          options={[
            { value: 'calendar', label: `🚪 ${ta.viewCalendar}` },
            { value: 'compact', label: `▦ ${ta.viewCompact}` },
          ]}
        />
        {calendar && calendar.today === 0 && (
          <div className="advent-countdown" role="status">⏳ {ta.countdown(calendar.days_until_start)}</div>
        )}
        {calendar && calendar.today >= 1 && calendar.today <= 26 && doorsByDay.get(calendar.today)
          && !isOpened(calendar.today) && (
          <div className="advent-hint">{ta.todayHint}</div>
        )}
      </header>

      {error && <Alert type="error" showIcon title={ta.loadError} style={{ maxWidth: 560, margin: '0 auto' }} />}
      {!calendar && !error && <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>}

      {calendar && view === 'calendar' && (
        <div className="advent-grid">
          {SHUFFLED_DAYS.map(day => doorsByDay.get(day)).filter((d): d is AdventDoor => Boolean(d)).map(d => renderDoor(d))}
          {showBonus && bonus && renderDoor(bonus)}
        </div>
      )}

      {calendar && view === 'compact' && featured && (
        <div className="advent-compact">
          <div className="advent-featured" ref={featuredRef}>
            <div className="advent-featured__label">
              {featured.state === 'today' ? ta.featuredToday : formatDay(featured.day)}
            </div>
            {renderDoor(featured, 'advent-door--featured')}
          </div>
          <div className="advent-tiles">
            {orderedDoors.map(renderTile)}
          </div>
        </div>
      )}

      <MovieModal
        door={shown}
        dateLabel={shown ? formatDay(shown.day) : ''}
        posterUrl={shown?.movie?.has_poster ? adventPosterUrl(shown.day) : undefined}
        onClose={() => setShown(null)}
      />
    </div>
  );
}

function MovieModal({ door, dateLabel, posterUrl, onClose }: {
  door: AdventDoor | null;
  dateLabel: string;
  posterUrl?: string;
  onClose: () => void;
}) {
  const { advent: ta } = useI18n().t;
  const { theme } = useXmasTheme();
  const icons = theme === 'cats'
    ? { watch: '🐟', trailer: '🧶', imdb: '🐾', day: '🐾' }
    : { watch: '🍬', trailer: '🍪', imdb: '⭐', day: '🎄' };
  const movie: AdventMovie | undefined = door?.movie;
  const watch = safeLink(movie?.movie_link);
  const trailer = safeLink(movie?.trailer_link);
  const imdb = safeLink(movie?.url_IMDB);
  const platform = platformOf(watch);

  return (
    <Modal
      open={Boolean(door)}
      onCancel={onClose}
      footer={null}
      centered
      width={720}
      className="advent-modal"
      closable={{ 'aria-label': ta.close }}
      destroyOnHidden
    >
      {door && (
        <div className="advent-card">
          <div className="advent-card__poster">
            {posterUrl ? <img src={posterUrl} alt={movie?.title ?? ''} /> : <span aria-hidden="true">🎬</span>}
          </div>
          <div className="advent-card__body">
            <div className="advent-card__day">{icons.day} {door.bonus ? `${ta.bonus} · ${dateLabel}` : dateLabel}</div>
            <h2 className="advent-card__title">{movie?.title ?? ta.noMovie}</h2>
            <div className="advent-card__buttons">
              {watch && (
                <a className="advent-btn advent-btn--candy" href={watch} target="_blank" rel="noopener noreferrer">
                  <span aria-hidden="true">{icons.watch}</span> {ta.watch}
                  {platform && <small className="advent-btn__sub">{ta.on(platform)}</small>}
                </a>
              )}
              {trailer && (
                <a className="advent-btn advent-btn--gingerbread" href={trailer} target="_blank" rel="noopener noreferrer">
                  <span aria-hidden="true">{icons.trailer}</span> {ta.trailer}
                </a>
              )}
              {imdb && (
                <a className="advent-btn advent-btn--ornament" href={imdb} target="_blank" rel="noopener noreferrer">
                  <span aria-hidden="true">{icons.imdb}</span> {ta.imdb}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
