import { getDatabase } from './rxdb';

let dbInstance = null;

async function getDb() {
  if (!dbInstance) {
    dbInstance = await getDatabase();
  }
  return dbInstance;
}

export const db = {
  searches: {
    add: async (data) => {
      const db = await getDb();
      const doc = await db.runs.insert({
        id: `search_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        userId: 'default',
        query: data.query,
        engine: data.engine,
        status: 'completed',
        startedAt: data.timestamp,
        completedAt: data.timestamp,
        fileIds: data.resultIds || [],
        outputIds: []
      });
      return doc.id;
    },
    update: async (id, updates) => {
      const db = await getDb();
      const doc = await db.runs.findOne({ selector: { id } }).exec();
      if (doc) await doc.update({ $set: updates });
    },
    orderBy: (field) => ({
      reverse: () => ({
        toArray: async () => {
          const db = await getDb();
          return db.runs.find({
            selector: { userId: 'default' },
            sort: [{ [field]: 'desc' }]
          }).exec();
        }
      }),
      toArray: async () => {
        const db = await getDb();
        return db.runs.find({
          selector: { userId: 'default' },
          sort: [{ [field]: 'asc' }]
        }).exec();
      }
    }),
    delete: async (id) => {
      const db = await getDb();
      const doc = await db.runs.findOne({ selector: { id } }).exec();
      if (doc) await doc.remove();
    },
    clear: async () => {
      const db = await getDb();
      const docs = await db.runs.find({ selector: { userId: 'default' } }).exec();
      for (const doc of docs) await doc.remove();
    },
    last: async () => {
      const db = await getDb();
      const docs = await db.runs.find({
        selector: { userId: 'default' },
        sort: [{ startedAt: 'desc' }]
      }).limit(1).exec();
      return docs[0] || null;
    }
  },
  results: {
    add: async (data) => {
      const db = await getDb();
      const doc = await db.files.insert({
        id: `result_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        runId: data.searchId,
        userId: 'default',
        url: data.url,
        filename: data.title,
        type: 'result',
        mimeType: 'text/plain',
        content: data.snippet,
        embedding: [],
        metadata: {
          rank: data.rank,
          engine: data.engine,
          displayUrl: data.displayUrl
        },
        createdAt: data.timestamp
      });
      return doc.id;
    },
    where: (field) => ({
      equals: (value) => ({
        delete: async () => {
          const db = await getDb();
          const docs = await db.files.find({ selector: { [field]: value } }).exec();
          for (const doc of docs) await doc.remove();
        }
      })
    }),
    clear: async () => {
      const db = await getDb();
      const docs = await db.files.find({ selector: { userId: 'default' } }).exec();
      for (const doc of docs) await doc.remove();
    }
  },
  attachments: {
    add: async (data) => {
      const db = await getDb();
      await db.files.insert({
        id: `attachment_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        runId: data.searchId,
        userId: 'default',
        url: data.filename,
        filename: data.filename,
        type: data.type,
        mimeType: 'application/octet-stream',
        content: data.content,
        embedding: [],
        metadata: { resultId: data.resultId },
        createdAt: data.timestamp
      });
    }
  },
  summaries: {
    add: async (data) => {
      const db = await getDb();
      await db.outputs.insert({
        id: `summary_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        runId: data.searchId,
        userId: 'default',
        type: 'summary',
        content: data.content,
        embedding: [],
        createdAt: data.timestamp
      });
    },
    where: (field) => ({
      equals: (value) => ({
        delete: async () => {
          const db = await getDb();
          const docs = await db.outputs.find({ selector: { [field]: value } }).exec();
          for (const doc of docs) await doc.remove();
        }
      })
    }),
    clear: async () => {
      const db = await getDb();
      const docs = await db.outputs.find({ selector: { userId: 'default' } }).exec();
      for (const doc of docs) await doc.remove();
    }
  },
  telemetry: {
    add: async (data) => {
      const db = await getDb();
      await db.outputs.insert({
        id: `telemetry_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        runId: 'telemetry',
        userId: 'default',
        type: 'telemetry',
        content: JSON.stringify({ event: data.event, data: data.data }),
        embedding: [],
        metadata: { event: data.event },
        createdAt: data.timestamp
      });
    },
    orderBy: (field) => ({
      reverse: () => ({
        limit: (n) => ({
          toArray: async () => {
            const db = await getDb();
            return db.outputs.find({
              selector: { type: 'telemetry' },
              sort: [{ [field]: 'desc' }]
            }).limit(n).exec();
          }
        })
      })
    }),
    toArray: async () => {
      const db = await getDb();
      return db.outputs.find({ selector: { type: 'telemetry' } }).exec();
    },
    clear: async () => {
      const db = await getDb();
      const docs = await db.outputs.find({ selector: { type: 'telemetry' } }).exec();
      for (const doc of docs) await doc.remove();
    }
  }
};
