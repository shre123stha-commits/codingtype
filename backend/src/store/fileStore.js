import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../data');
const file = path.join(dataDir, 'db.json');
const MAX_SESSIONS = 500;

function load() {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (parsed && Array.isArray(parsed.sessions)) return parsed;
  } catch {
    /* first boot */
  }
  return { sessions: [] };
}

const cache = load();
let queue = Promise.resolve();

function persist() {
  queue = queue
    .then(
      () =>
        new Promise((resolve) => {
          fs.mkdirSync(dataDir, { recursive: true });
          const tmp = `${file}.tmp`;
          fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
          fs.renameSync(tmp, file);
          resolve();
        })
    )
    .catch((err) => console.error('[codetype-api] persist failed', err));
  return queue;
}

export const db = {
  addSession(row) {
    cache.sessions.unshift(row);
    if (cache.sessions.length > MAX_SESSIONS) cache.sessions.length = MAX_SESSIONS;
    return persist();
  },
  list(limit) {
    return cache.sessions.slice(0, limit);
  },
  all() {
    return cache.sessions;
  }
};
