// Career 1v1 record (wins/losses) kept in localStorage — feeds the
// "VICTORIES" stat on the post-race flash card.
const KEY = 'codetype-race-record';

export function getRaceRecord() {
  try {
    const j = JSON.parse(localStorage.getItem(KEY));
    if (j && typeof j.w === 'number' && typeof j.l === 'number') return j;
  } catch {
    /* fresh start */
  }
  return { w: 0, l: 0 };
}

export function saveRaceRecord(rec) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rec));
  } catch {
    /* private mode */
  }
}
