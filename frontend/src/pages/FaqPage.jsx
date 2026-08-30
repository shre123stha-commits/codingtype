import SitePage from './SitePage.jsx';

// Keep in sync with the FAQPage JSON-LD in frontend/index.html
const FAQS = [
  [
    'What is CodeType?',
    'A typing trainer built for software developers. You type real production code — Express routers, React components, SQL, Rust — instead of random dictionary words, and get WPM, accuracy and per-key telemetry for the symbols you actually use every day.'
  ],
  [
    'How is it different from Monkeytype or TypingClub?',
    'Those train general words from lorem ipsum. CodeType trains development syntax: braces, quotes, arrows, semicolons. Its blind modes hide characters ahead of your caret, which builds chunk-level muscle memory for code patterns instead of letter-by-letter reading.'
  ],
  [
    'What does BLIND 3CH actually train?',
    'Blind mode hides the text and reveals only the few characters right in front of your caret. 3CH shows three characters ahead, so your brain stops reading one glyph at a time and starts recognizing symbol patterns — the way experienced developers read code on a dark terminal.'
  ],
  [
    'Where is my typing data stored?',
    'By default everything stays in your browser (localStorage) — nothing is uploaded. If you create an account with email + password, your sessions, personal bests and profile sync to your own Supabase cloud account. Those rows are protected by row-level security, so only you can read them.'
  ],
  [
    'Is CodeType free?',
    'Yes — free, with no paywall. The site is supported by the unobtrusive ad banners you may see. The waitlist is only for early access to new features; it is never a paywall announcement.'
  ]
];

export default function FaqPage() {
  return (
    <SitePage
      path="/faq"
      title="FAQ — CodeType"
      description="Answers to the five questions everyone asks about CodeType: what it is, blind modes, data privacy, and pricing."
    >
      <div className="space-y-2.5">
        {FAQS.map(([q, a], i) => (
          <details key={q} className="faq-item" open={i === 0}>
            <summary>
              <span className="text-[11px] font-semibold tracking-[0.08em] text-ink">{q}</span>
              <span className="faq-x shrink-0 text-accent" aria-hidden="true">
                +
              </span>
            </summary>
            <p className="mt-3 text-[10px] leading-relaxed tracking-[0.04em] text-dim">{a}</p>
          </details>
        ))}
      </div>
    </SitePage>
  );
}
