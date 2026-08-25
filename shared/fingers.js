export const FINGERS = [
  { id: 'l_pinky', label: 'L PINKY', keys: '`1qaz~!' },
  { id: 'l_ring', label: 'L RING', keys: '2wsx@' },
  { id: 'l_middle', label: 'L MIDDLE', keys: '3edc#' },
  { id: 'l_index', label: 'L INDEX', keys: '45rtfgvbynh$%' },
  { id: 'r_index', label: 'R INDEX', keys: '67uijkm^&,.' },
  { id: 'r_middle', label: 'R MIDDLE', keys: '8ol*' },
  { id: 'r_ring', label: 'R RING', keys: '9p;/' },
  { id: 'r_pinky', label: 'R PINKY', keys: "0-='[]{}\\)_+|" }
];

const CH_TO_FINGER = new Map();
for (const f of FINGERS) {
  for (const ch of f.keys) CH_TO_FINGER.set(ch, f.id);
}
CH_TO_FINGER.set(' ', 'r_index');
CH_TO_FINGER.set('\t', 'l_pinky');
CH_TO_FINGER.set('\n', 'l_pinky');
CH_TO_FINGER.set('<', 'l_pinky');
CH_TO_FINGER.set('>', 'l_pinky');
CH_TO_FINGER.set('?', 'l_ring');
CH_TO_FINGER.set(':', 'l_middle');
CH_TO_FINGER.set('"', 'l_ring');

export function fingerOf(ch) {
  if (ch == null) return null;
  const c = String(ch).length === 1 ? ch : String(ch);
  if (CH_TO_FINGER.has(c)) return CH_TO_FINGER.get(c);
  if (c >= 'A' && c <= 'Z') return CH_TO_FINGER.get(c.toLowerCase()) || null;
  return 'l_index';
}
