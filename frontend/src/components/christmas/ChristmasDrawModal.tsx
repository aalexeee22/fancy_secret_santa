import { Alert, Modal, Space } from 'antd';
import FestiveButton from './FestiveButton';
import Character from './Character';
import { useThemeEmoji } from './themeContext';

export type DrawPhase = 'confirm' | 'drawing' | 'success' | 'error';

export interface DrawOutcome {
  hasEmail: boolean;
  emailsSent: number;
  failedCount: number;
  pendingCount: number;
}

interface ChristmasDrawModalProps {
  open: boolean;
  phase: DrawPhase;
  participantCount: number;
  hasEmail: boolean;
  outcome: DrawOutcome | null;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

function Stage({ drawing }: { drawing: boolean }) {
  const ORBIT = useThemeEmoji().orbit;
  return (
    <div className={`xmas-draw-stage${drawing ? ' is-drawing' : ''}`} aria-hidden="true">
      {drawing && (
        <div className="xmas-orbit">
          {ORBIT.map((emoji, i) => {
            const angle = (i / ORBIT.length) * 360;
            return (
              <span key={i} style={{ transform: `rotate(${angle}deg) translate(68px) rotate(-${angle}deg) translate(-50%, -50%)` }}>
                {emoji}
              </span>
            );
          })}
        </div>
      )}
      <Character role="santa" className="xmas-draw-stage__sack" />
    </div>
  );
}

/**
 * Modalul tragerii la sorți. Animațiile urmăresc starea reală a cererii:
 * așteptare cât lucrează serverul, sărbătoare doar după răspunsul de succes.
 */
export default function ChristmasDrawModal({ open, phase, participantCount, hasEmail, outcome, error, onConfirm, onClose }: ChristmasDrawModalProps) {
  const drawing = phase === 'drawing';

  return (
    <Modal
      open={open}
      onCancel={drawing ? undefined : onClose}
      closable={!drawing}
      mask={{ closable: !drawing }}
      keyboard={!drawing}
      footer={null}
      centered
      title={null}
      width={460}
      destroyOnHidden
    >
      <div style={{ textAlign: 'center', paddingTop: 8 }}>
        {phase === 'confirm' && (
          <>
            <Stage drawing={false} />
            <h2 style={{ fontFamily: 'Georgia, serif', color: '#2B3E50', marginBottom: 8 }}>Tragem la sorți?</h2>
            <p style={{ color: '#5d6d7e', lineHeight: 1.6 }}>
              Cei <strong>{participantCount}</strong> spiriduși vor fi amestecați în sac. Tragerea <strong>nu poate fi anulată</strong>, iar înscrierea se închide.
            </p>
            {hasEmail ? (
              <p style={{ color: '#5d6d7e', lineHeight: 1.6 }}>Fiecare participant va primi pe email cui îi face cadou.</p>
            ) : (
              <Alert
                type="warning"
                showIcon
                style={{ textAlign: 'left', marginTop: 8 }}
                title="Emailul nu este configurat"
                description="Tragerea se va face, dar participanții nu vor fi anunțați: aplicația trimite perechile doar pe email."
              />
            )}
            <Space style={{ marginTop: 20 }} wrap>
              <FestiveButton tone="light" small onClick={onClose} style={{ boxShadow: '0 0 0 2px #e5e7eb' }}>Mai aștept</FestiveButton>
              <FestiveButton tone="red" small gift="🎲" onClick={onConfirm}>Trage la sorți!</FestiveButton>
            </Space>
          </>
        )}

        {phase === 'drawing' && (
          <div role="status" aria-live="polite">
            <Stage drawing />
            <h2 style={{ fontFamily: 'Georgia, serif', color: '#2B3E50' }}>Moș Crăciun pregătește surprizele...</h2>
            <p style={{ color: '#7f8c8d' }}>{hasEmail ? 'Amestecăm numele și pregătim emailurile pentru trimitere.' : 'Amestecăm numele.'}</p>
          </div>
        )}

        {phase === 'success' && outcome && (
          <div role="status" aria-live="polite" className="xmas-fade-in">
            <div style={{ fontSize: '4rem', lineHeight: 1.2 }} aria-hidden="true">🎁</div>
            <h2 style={{ fontFamily: 'Georgia, serif', color: '#1E8449', margin: '8px 0' }}>Ho ho ho! Cadourile și-au găsit destinatarii! 🎁</h2>
            {!outcome.hasEmail && (
              <p style={{ color: '#5d6d7e' }}>Emailul nu era configurat, așa că participanții nu au fost anunțați.</p>
            )}
            {outcome.hasEmail && outcome.pendingCount > 0 && (
              <p style={{ color: '#5d6d7e' }}>Emailurile se trimit în fundal. Poți închide această fereastră; progresul apare pe pagina grupului.</p>
            )}
            {outcome.hasEmail && outcome.failedCount === 0 && outcome.pendingCount === 0 && (
              <p style={{ color: '#5d6d7e' }}>{outcome.emailsSent} emailuri trimise. Fiecare își află perechea în inbox.</p>
            )}
            {outcome.hasEmail && outcome.failedCount > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ textAlign: 'left' }}
                title={`${outcome.failedCount} emailuri nu au putut fi trimise`}
                description="Le poți retrimite din pagina grupului. Linkul de admin rămâne valid până pleacă toate."
              />
            )}
            <p style={{ color: '#95a5a6', fontSize: '0.85rem', marginTop: 12 }}>Nici tu nu vezi cine pe cine a tras. Surpriza e pentru toți!</p>
            <FestiveButton tone="green" small onClick={onClose} style={{ marginTop: 8 }}>Gata</FestiveButton>
          </div>
        )}

        {phase === 'error' && (
          <div role="alert" className="xmas-fade-in">
            <Stage drawing={false} />
            <h2 style={{ fontFamily: 'Georgia, serif', color: '#C0392B', marginBottom: 8 }}>Sania s-a împotmolit</h2>
            <Alert type="error" showIcon title={error || 'Tragerea la sorți nu a reușit.'} style={{ textAlign: 'left' }} />
            <Space style={{ marginTop: 20 }} wrap>
              <FestiveButton tone="light" small onClick={onClose} style={{ boxShadow: '0 0 0 2px #e5e7eb' }}>Închide</FestiveButton>
              <FestiveButton tone="red" small onClick={onConfirm}>Încearcă din nou</FestiveButton>
            </Space>
          </div>
        )}
      </div>
    </Modal>
  );
}
