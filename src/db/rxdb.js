import { createRxDatabase, addRxPlugin } from 'rxdb';
import { getRxStorageLocalstorage } from 'rxdb/plugins/storage-localstorage';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { generateEmbedding as computeEmbedding, cosineSimilarity as calcCosineSimilarity } from '../services/embeddingService.js';

addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);

const userSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    createdAt: { type: 'number' }
  },
  required: ['id']
};

const runSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    userId: { type: 'string', maxLength: 100 },
    query: { type: 'string' },
    engine: { type: 'string' },
    status: { type: 'string' },
    startedAt: { type: 'number' },
    completedAt: { type: 'number' },
    fileIds: { type: 'array', items: { type: 'string' } },
    outputIds: { type: 'array', items: { type: 'string' } }
  },
  required: ['id', 'userId', 'query']
};

const fileSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    runId: { type: 'string', maxLength: 100 },
    userId: { type: 'string', maxLength: 100 },
    url: { type: 'string' },
    filename: { type: 'string' },
    type: { type: 'string' },
    mimeType: { type: 'string' },
    size: { type: 'number' },
    content: { type: 'string' },
    ocrContent: { type: 'string' },
    embedding: { type: 'array', items: { type: 'number' } },
    metadata: { type: 'object' },
    createdAt: { type: 'number' }
  },
  required: ['id', 'runId', 'userId', 'url']
};

const outputSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    runId: { type: 'string', maxLength: 100 },
    userId: { type: 'string', maxLength: 100 },
    type: { type: 'string' },
    content: { type: 'string' },
    embedding: { type: 'array', items: { type: 'number' } },
    metadata: { type: 'object' },
    createdAt: { type: 'number' }
  },
  required: ['id', 'runId', 'userId', 'type']
};

const globalScope = typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : {});

let dbInstance = null;

export async function getDatabase() {
  if (dbInstance && !dbInstance.destroyed) return dbInstance;
  if (globalScope.__attachsurfer_rxdb__ && !globalScope.__attachsurfer_rxdb__.destroyed) {
    dbInstance = globalScope.__attachsurfer_rxdb__;
    return dbInstance;
  }
  if (globalScope.__attachsurfer_rxdb_promise__) {
    return await globalScope.__attachsurfer_rxdb_promise__;
  }

  globalScope.__attachsurfer_rxdb_promise__ = (async () => {
    try {
      const db = await createRxDatabase({
        name: 'attachsurfer_db',
        storage: getRxStorageLocalstorage()
      });

      const collectionsToAdd = {};
      if (!db.users && !db.collections?.users) collectionsToAdd.users = { schema: userSchema };
      if (!db.runs && !db.collections?.runs) collectionsToAdd.runs = { schema: runSchema };
      if (!db.files && !db.collections?.files) collectionsToAdd.files = { schema: fileSchema };
      if (!db.outputs && !db.collections?.outputs) collectionsToAdd.outputs = { schema: outputSchema };

      if (Object.keys(collectionsToAdd).length > 0) {
        await db.addCollections(collectionsToAdd);
      }

      globalScope.__attachsurfer_rxdb__ = db;
      dbInstance = db;
      return db;
    } catch (err) {
      delete globalScope.__attachsurfer_rxdb_promise__;
      throw err;
    }
  })();

  return await globalScope.__attachsurfer_rxdb_promise__;
}

export function resetDatabaseInstance() {
  dbInstance = null;
  if (globalScope.__attachsurfer_rxdb__) {
    delete globalScope.__attachsurfer_rxdb__;
  }
  if (globalScope.__attachsurfer_rxdb_promise__) {
    delete globalScope.__attachsurfer_rxdb_promise__;
  }
}

export async function ensureUser(userId = 'default') {
  const db = await getDatabase();
  const existing = await db.users.findOne({ selector: { id: userId } }).exec();
  if (existing) return existing;

  return db.users.insert({
    id: userId,
    name: 'Default User',
    createdAt: Date.now()
  });
}

export async function createRun(userId, query, engine) {
  const db = await getDatabase();
  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  return db.runs.insert({
    id: runId,
    userId,
    query,
    engine,
    status: 'pending',
    startedAt: Date.now(),
    fileIds: [],
    outputIds: []
  });
}

export async function updateRun(runId, updates) {
  const db = await getDatabase();
  const run = await db.runs.findOne({ selector: { id: runId } }).exec();
  if (!run) throw new Error(`Run ${runId} not found`);
  return run.update({ $set: updates });
}

export async function addFile(runId, userId, fileData) {
  const db = await getDatabase();
  const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const file = await db.files.insert({
    id: fileId,
    runId,
    userId,
    url: fileData.url,
    filename: fileData.filename || fileData.url.split('/').pop(),
    type: fileData.type || 'unknown',
    mimeType: fileData.mimeType || '',
    size: fileData.size || 0,
    content: fileData.content || '',
    ocrContent: fileData.ocrContent || '',
    embedding: fileData.embedding || [],
    metadata: fileData.metadata || {},
    createdAt: Date.now()
  });

  const run = await db.runs.findOne({ selector: { id: runId } }).exec();
  if (run) {
    await run.update({
      $set: { fileIds: [...(run.fileIds || []), fileId] }
    });
  }

  return file;
}

export async function updateFile(fileId, updates) {
  const db = await getDatabase();
  const file = await db.files.findOne({ selector: { id: fileId } }).exec();
  if (!file) throw new Error(`File ${fileId} not found`);
  return file.update({ $set: updates });
}

export async function addOutput(runId, userId, outputData) {
  const db = await getDatabase();
  const outputId = `output_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const output = await db.outputs.insert({
    id: outputId,
    runId,
    userId,
    type: outputData.type || 'summary',
    content: outputData.content || '',
    embedding: outputData.embedding || [],
    metadata: outputData.metadata || {},
    createdAt: Date.now()
  });

  const run = await db.runs.findOne({ selector: { id: runId } }).exec();
  if (run) {
    await run.update({
      $set: { outputIds: [...(run.outputIds || []), outputId] }
    });
  }

  return output;
}

export async function searchFiles(userId, queryEmbedding, limit = 10) {
  const db = await getDatabase();
  const files = await db.files.find({
    selector: { userId }
  }).exec();

  const scored = files
    .map(doc => {
      const plain = typeof doc.toJSON === 'function' ? doc.toJSON() : (doc._data || doc);
      const embedding = plain.embedding || doc.embedding;
      return {
        ...plain,
        embedding,
        score: embedding && embedding.length > 0 ? cosineSimilarity(queryEmbedding, embedding) : 0
      };
    })
    .filter(f => f.embedding && f.embedding.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

export async function searchOutputs(userId, queryEmbedding, limit = 10) {
  const db = await getDatabase();
  const outputs = await db.outputs.find({
    selector: { userId }
  }).exec();

  const scored = outputs
    .map(doc => {
      const plain = typeof doc.toJSON === 'function' ? doc.toJSON() : (doc._data || doc);
      const embedding = plain.embedding || doc.embedding;
      return {
        ...plain,
        embedding,
        score: embedding && embedding.length > 0 ? cosineSimilarity(queryEmbedding, embedding) : 0
      };
    })
    .filter(o => o.embedding && o.embedding.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

export async function getRun(runId) {
  const db = await getDatabase();
  return db.runs.findOne({ selector: { id: runId } }).exec();
}

export async function getRunFiles(runId) {
  const db = await getDatabase();
  return db.files.find({ selector: { runId } }).exec();
}

export async function getRunOutputs(runId) {
  const db = await getDatabase();
  return db.outputs.find({ selector: { runId } }).exec();
}

export async function getUserRuns(userId) {
  const db = await getDatabase();
  return db.runs.find({
    selector: { userId },
    sort: [{ startedAt: 'desc' }]
  }).exec();
}

export async function deleteRun(runId) {
  const db = await getDatabase();
  const files = await db.files.find({ selector: { runId } }).exec();
  const outputs = await db.outputs.find({ selector: { runId } }).exec();

  for (const file of files) await file.remove();
  for (const output of outputs) await output.remove();

  const run = await db.runs.findOne({ selector: { id: runId } }).exec();
  if (run) await run.remove();
}

export function cosineSimilarity(a, b) {
  return calcCosineSimilarity(a, b);
}

export async function generateEmbedding(text, options) {
  return await computeEmbedding(text, options);
}

export async function getDocumentSummary({ fileId, url }) {
  try {
    const db = await getDatabase();
    if (!db) return null;

    if (fileId && db.files) {
      const file = await db.files.findOne({ selector: { id: fileId } }).exec();
      if (file) {
        const doc = typeof file.toJSON === 'function' ? file.toJSON() : file;
        if (doc.metadata?.summary) {
          return {
            content: doc.metadata.summary,
            createdAt: doc.metadata.summaryCreatedAt || doc.createdAt,
            cached: true
          };
        }
      }
    }

    if (db.outputs) {
      const outputs = await db.outputs.find({
        selector: { type: 'document_summary' }
      }).exec();

      const match = outputs
        .map(o => typeof o.toJSON === 'function' ? o.toJSON() : o)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .find(o => (fileId && o.metadata?.fileId === fileId) || (url && o.metadata?.url === url));

      if (match) {
        return {
          id: match.id,
          content: match.content,
          createdAt: match.createdAt,
          cached: true
        };
      }
    }
  } catch (err) {
    console.warn('Failed to retrieve document summary from DB:', err);
  }
  return null;
}

export async function saveDocumentSummary({ fileId, url, filename, summaryText }) {
  const db = await getDatabase();
  if (!db || !db.outputs) return null;

  const embedding = await generateEmbedding(summaryText);
  const summaryId = `doc_summary_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const output = await db.outputs.insert({
    id: summaryId,
    runId: 'document_summaries',
    userId: 'default',
    type: 'document_summary',
    content: summaryText,
    embedding,
    metadata: { fileId, url, filename },
    createdAt: Date.now()
  });

  if (fileId) {
    try {
      const file = await db.files.findOne({ selector: { id: fileId } }).exec();
      if (file) {
        const existingMeta = file.metadata || {};
        await file.update({
          $set: {
            metadata: {
              ...existingMeta,
              summary: summaryText,
              summaryCreatedAt: Date.now()
            }
          }
        });
      }
    } catch {
      // ignore
    }
  }

  return typeof output.toJSON === 'function' ? output.toJSON() : output;
}
