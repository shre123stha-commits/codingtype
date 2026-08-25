import { useState } from 'react';

import { api } from '../utils/api.js';
import { buildAdaptiveDrill } from '../utils/adaptiveDrill.js';
import { useGameStore } from '../store/gameStore.js';

export default function AdaptivePanel() {
  const [symbols, setSymbols] = useState(null);
  const [adaptive, setAdaptive] = useState(true);
  const [busy, setBusy] = useState(false);
  const loadSnippet = useGameStore((s) => s.loadSnippet);

  const generate = async () => {
    setBusy(true);
    try {
      const d = await api.adaptive();
      setSymbols(d.symbols.map((s) => s.key));
      setAdaptive(d.adaptive);
      loadSnippet(buildAdaptiveDrill(d.symbols));
    } catch {
      setSymbols([';', '}', '=>']);
      setAdaptive(false);
      loadSnippet(buildAdaptiveDrill([{ key: ';' }, { key: '}' }, { key: '=>' }]));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={generate}
        disabled={busy}
        className="chip chip-on-cyan w-full py-2 disabled:opacity-50"
      >
        {busy ? 'ANALYZING…' : '▸ GENERATE DRILL'}
      </button>
      <p className="text-[9px] leading-relaxed tracking-[0.08em] text-faint">
        {symbols
          ? `TARGETS: ${symbols.join(' · ')}${adaptive ? '' : ' (default set — no error data yet)'}`
          : 'READS YOUR PAST RUNS, FINDS YOUR 3 WORST SYMBOLS, AND BUILDS A 15s DRILL AROUND THEM.'}
      </p>
    </div>
  );
}
