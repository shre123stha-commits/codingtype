import AdSlot from './AdSlot.jsx';
import DiagnosticDashboard from './DiagnosticDashboard.jsx';
import FrictionPreview from './FrictionPreview.jsx';
import LiveHud from './LiveHud.jsx';
import ModeDeck from './ModeDeck.jsx';
import TypingArena from './TypingArena.jsx';
import { useTypingEngine } from '../hooks/useTypingEngine.js';
import { useGameStore } from '../store/gameStore.js';

// Languages live at the center of the home page now — pick one directly,
// no digging through the control deck.
const HOME_LANGS = [
  ['python', 'PYTHON'],
  ['javascript', 'JAVASCRIPT'],
  ['java', 'JAVA'],
  ['c++', 'C++'],
  ['rust', 'RUST'],
  ['sql', 'SQL']
];

function LanguageRow() {
  const language = useGameStore((s) => s.language);
  const setLanguage = useGameStore((s) => s.setLanguage);
  return (
    <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="choose language">
      <span className="mr-1 text-[9px] font-semibold tracking-[0.22em] text-faint">LANGUAGE</span>
      {HOME_LANGS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setLanguage(id)}
          title={`Switch to ${label} — a fresh ${label} target loads automatically`}
          className={`chip !px-3 !py-1 !text-[10px] ${language === id ? 'chip-on-cyan' : 'chip-off'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export default function TrainView() {
  const captureRef = useTypingEngine();
  const status = useGameStore((s) => s.status);

  return (
    <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
      <div className="order-2 xl:order-1">
        <ModeDeck />
        <AdSlot variant="box" className="mt-4" />
      </div>
      <div className="order-1 space-y-4 xl:order-2">
        {status === 'finished' ? (
          <DiagnosticDashboard />
        ) : (
          <>
            <p className="pt-1 text-center text-[10px] font-semibold tracking-[0.34em] text-faint">
              TYPE REAL CODE · TRAIN THE MUSCLE MEMORY
            </p>
            <LanguageRow />
            <LiveHud />
            <TypingArena captureRef={captureRef} />
          </>
        )}
      </div>
      <div className="order-3">
        {/* SESSION LOG lives in the ANALYTICS tab — home stays clean */}
        <FrictionPreview />
        <AdSlot variant="box" className="mt-4" />
      </div>
    </main>
  );
}
