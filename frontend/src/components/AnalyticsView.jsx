import FingerPanel from './FingerPanel.jsx';
import HistoryPanel from './HistoryPanel.jsx';
import KeyHeatmap from './KeyHeatmap.jsx';
import TrendChart from './TrendChart.jsx';
import { useAnalytics } from '../hooks/useApi.js';
import { useGameStore } from '../store/gameStore.js';

export default function AnalyticsView() {
  const { keyStats, fingerStats, sessions, pbests } = useAnalytics();
  const theme = useGameStore((s) => s.theme);

  return (
    <main className="mx-auto grid max-w-[1600px] grid-cols-1 gap-4 p-4 xl:grid-cols-2">
      <KeyHeatmap chars={keyStats} />
      <FingerPanel fingers={fingerStats} />
      <TrendChart sessions={sessions} theme={theme} />
      <HistoryPanel />
    </main>
  );
}
