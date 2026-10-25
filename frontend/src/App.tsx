import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { App as AntApp, ConfigProvider, Spin } from 'antd';
import roRO from 'antd/locale/ro_RO';
import { christmasTheme } from './theme';
import ChristmasSnow from './components/christmas/ChristmasSnow';
import ChristmasLights from './components/christmas/ChristmasLights';
import SantaSleigh from './components/christmas/SantaSleigh';
import ChristmasConfettiProvider from './components/christmas/ChristmasConfetti';
import WinterFooter from './components/christmas/WinterFooter';
import XmasThemeProvider from './components/christmas/XmasThemeProvider';
import ThemeToggle from './components/christmas/ThemeToggle';
import Character from './components/christmas/Character';
import Home from './pages/Home';

// Paginile cu formulare, modale și grafice se încarcă doar când sunt deschise.
const Create = lazy(() => import('./pages/Create'));
const Admin = lazy(() => import('./pages/Admin'));
const Join = lazy(() => import('./pages/Join'));
const Success = lazy(() => import('./pages/Success'));
const StatsPage = lazy(() => import('./pages/Stats'));

function Navbar() {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="xmas-nav" style={{
      background: 'linear-gradient(135deg, #8B0000, #C0392B)',
      padding: '0 24px',
      boxShadow: '0 2px 20px rgba(192,57,43,0.4)',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', height: 64 }}>
        <Link to="/" className="nav-logo" style={{ whiteSpace: 'nowrap', fontFamily: 'Georgia, serif', fontSize: '1.4rem', fontWeight: 900, color: '#fff', textDecoration: 'none', letterSpacing: 1, marginRight: 'auto' }}>
          <Character role="santa" /> Secret Santa
        </Link>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[
            { path: '/create', label: '🎄 Grup nou' },
            { path: '/stats', label: '📊 Statistici' },
          ].map(({ path, label }) => (
            <Link
              key={path}
              to={path}
              className="nav-link"
              style={{
                whiteSpace: 'nowrap',
                color: isActive(path) ? '#FFD700' : 'rgba(255,255,255,0.85)',
                textDecoration: 'none',
                padding: '8px 14px',
                borderRadius: 8,
                fontWeight: isActive(path) ? 700 : 500,
                fontSize: '0.9rem',
                background: isActive(path) ? 'rgba(255,255,255,0.1)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
      </div>
      <ChristmasLights />
      <SantaSleigh />
    </nav>
  );
}

function AppInner() {
  return (
    <>
      {/* Ninsoare discretă în spatele conținutului: se vede pe fundal, nu peste formulare */}
      <ChristmasSnow tone="ice" fixed density={0.5} />
      <Navbar />
      <main style={{ position: 'relative', zIndex: 1 }}>
        <Suspense fallback={<div style={{ textAlign: 'center', padding: '100px 20px' }}><Spin size="large" /></div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/create" element={<Create />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/join/:code" element={<Join />} />
            <Route path="/join/:code/success" element={<Success />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </Suspense>
      </main>
      <WinterFooter />
    </>
  );
}

export default function App() {
  return (
    <ConfigProvider theme={christmasTheme} locale={roRO}>
      <AntApp>
        <XmasThemeProvider>
          <ChristmasConfettiProvider>
            <BrowserRouter>
              <AppInner />
            </BrowserRouter>
          </ChristmasConfettiProvider>
        </XmasThemeProvider>
      </AntApp>
    </ConfigProvider>
  );
}
