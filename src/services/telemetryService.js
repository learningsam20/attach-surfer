import { getDatabase } from '../db/rxdb';

export async function trackEvent(eventName, data = {}) {
  try {
    const enabled = import.meta.env.VITE_TELEMETRY_ENABLED !== 'false';
    if (!enabled) return;

    const db = await getDatabase();
    await db.outputs.insert({
      id: `telemetry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      runId: 'telemetry',
      userId: 'default',
      type: 'telemetry',
      content: '',
      embedding: [],
      metadata: { event: eventName, data },
      createdAt: Date.now()
    });
  } catch (err) {
    console.warn('Telemetry tracking failed:', err);
  }
}

export async function getTelemetryEvents(limit = 100) {
  const db = await getDatabase();
  return db.outputs.find({
    selector: { type: 'telemetry' },
    sort: [{ createdAt: 'desc' }]
  }).limit(limit).exec();
}

export async function clearTelemetry() {
  const db = await getDatabase();
  const docs = await db.outputs.find({ selector: { type: 'telemetry' } }).exec();
  for (const doc of docs) await doc.remove();
}

export async function getEventCounts() {
  const db = await getDatabase();
  const events = await db.outputs.find({ selector: { type: 'telemetry' } }).exec();
  const counts = {};
  events.forEach(e => {
    const eventName = e.metadata?.event || 'unknown';
    counts[eventName] = (counts[eventName] || 0) + 1;
  });
  return counts;
}
