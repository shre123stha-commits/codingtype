import AnalyticsView from './components/AnalyticsView.jsx';
import KeyLegend from './components/KeyLegend.jsx';
import RaceView from './components/RaceView.jsx';
import TopBar from './components/TopBar.jsx';
import TrainView from './components/TrainView.jsx';
import { useCatalog, useGhost, useSessionPost } from './hooks/useApi.js';
import { useTicker } from './hooks/useTicker.js';
import { useGameStore } from './store/gameStore.js';

export default function App() {
  useCatalog();
  useGhost();
  useSessionPost();
  useTicker(200);
  const view = useGameStore((s) => s.view);

  return (
    <div className="min-h-screen pb-14">
      <TopBar />
      {view === 'train' ? <TrainView /> : view === 'race' ? <RaceView /> : <AnalyticsView />}
      <KeyLegend />
    </div>
  );
}
