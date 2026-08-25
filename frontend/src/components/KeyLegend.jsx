export default function KeyLegend() {
  const keys = [
    ['TAB', 'CLAIM INDENT'],
    ['ENTER', 'NEWLINE + ALIGN'],
    ['ESC', 'PAUSE / RESUME'],
    ['⌫', 'REVISE LAST'],
    ['ENTER', 'RE-RUN ON COMPLETE']
  ];
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-20 border-t border-edge bg-panel/90 px-5 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-1">
        {keys.map(([k, label], i) => (
          <span key={i} className="flex items-center gap-2 text-[9px] tracking-[0.18em] text-faint">
            <kbd className="border border-edge2 bg-panel2 px-1.5 py-0.5 font-semibold text-dim">{k}</kbd>
            {label}
          </span>
        ))}
        <span className="ml-auto text-[9px] tracking-[0.22em] text-faint">
          CODETYPE // MOTOR-SKILL TRAINER FOR ENGINEERS
        </span>
      </div>
    </footer>
  );
}
