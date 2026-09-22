import Dexie from 'dexie';

export const db = new Dexie('AttachSurferDB');

db.version(1).stores({
  searches: '++id, query, engine, timestamp',
  results: '++id, searchId, rank, engine, url',
  attachments: '++id, resultId, filename, type',
  summaries: '++id, searchId, timestamp',
  telemetry: '++id, event, timestamp'
});

db.on('blocked', () => {
  console.warn('Database access is blocked by another tab.');
});

db.on('versionchange', () => {
  console.log('Database version change detected. Closing connection.');
  db.close();
});
