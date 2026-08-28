import DiagnosticDashboard from './DiagnosticDashboard.jsx';
import FrictionPreview from './FrictionPreview.jsx';
import LiveHud from './LiveHud.jsx';
import ModeDeck from './ModeDeck.jsx';
import TypingArena from './TypingArena.jsx';
import { useTypingEngine } from '../hooks/useTypingEngine.js';
import { useGameStore } from '../store/gameStore.js';

export default function TrainView() {
  const captureRef = useTypingEngine();
  const status = useGameStore((s) => s.status);

  return (
    <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 xl:grid-cols-[300px_minmax(0,1fr)_300px]">
      <div className="order-2 xl:order-1">
        <ModeDeck />
      </div>
      <div className="order-1 space-y-4 xl:order-2">
        {status === 'finished' ? (
          <DiagnosticDashboard />
        ) : (
          <>
            <p className="pt-1 text-center text-[10px] font-semibold tracking-[0.34em] text-faint">
              TYPE REAL CODE · TRAIN THE MUSCLE MEMORY
            </p>
            <LiveHud />
            <TypingArena captureRef={captureRef} />
          </>
        )}
      </div>
      <div className="order-3">
        {/* SESSION LOG lives in the ANALYTICS tab — home stays clean */}
        <FrictionPreview />
      </div>
    </main>
  );
}
