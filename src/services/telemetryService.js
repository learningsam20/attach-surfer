import { db } from '../db/database';

export async function trackEvent(eventName, data = {}) {
  try {
    const enabled = import.meta.env.VITE_TELEMETRY_ENABLED !== 'false';
    if (!enabled) return;

    await db.telemetry.add({
      event: eventName,
      data,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('Telemetry tracking failed:', err);
  }
}

export async function getTelemetryEvents(limit = 100) {
  return db.telemetry.orderBy('timestamp').reverse().limit(limit).toArray();
}

export async function clearTelemetry() {
  return db.telemetry.clear();
}

export async function getEventCounts() {
  const events = await db.telemetry.toArray();
  const counts = {};
  events.forEach(e => {
    counts[e.event] = (counts[e.event] || 0) + 1;
  });
  return counts;
}
