function getSavedConfig() {
  try {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('attachSurferConfig');
      if (saved) return JSON.parse(saved);
    }
  } catch {
    // ignore
  }
  return null;
}

export function getEmbeddingModelName() {
  return getSavedConfig()?.embeddingModel || import.meta.env.VITE_EMBEDDING_MODEL || 'embeddinggemma2';
}

export function getLocalModelsPath() {
  return getSavedConfig()?.localModelsPath || import.meta.env.VITE_LOCAL_MODELS_PATH || '/models';
}

let transformersModule = null;
let embeddingPipeline = null;
let isPipelineLoading = false;
let pipelineLoadAttempted = false;

export async function loadTransformers() {
  if (transformersModule) return transformersModule;

  try {
    transformersModule = await import('@huggingface/transformers');
    return transformersModule;
  } catch (err) {
    if (typeof window !== 'undefined') {
      try {
        transformersModule = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3');
        return transformersModule;
      } catch (cdnErr) {
        console.warn('Transformers.js runtime not available, using deterministic local embedding:', cdnErr);
      }
    }
    return null;
  }
}

export async function isLocalModelReady(basePath, modelTarget) {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
  try {
    const cleanBase = basePath.replace(/\/+$/, '');
    const manifestRes = await fetch(`${cleanBase}/${modelTarget}/model_manifest.json`);
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      if (manifest && manifest.hasWeights === false) return false;
      if (manifest && manifest.hasWeights === true) return true;
    }

    const onnxRes = await fetch(`${cleanBase}/${modelTarget}/onnx/model_quantized.onnx`, { method: 'HEAD' });
    if (!onnxRes.ok) return false;

    const dataRes = await fetch(`${cleanBase}/${modelTarget}/onnx/model_quantized.onnx_data`, { method: 'HEAD' });
    if (!dataRes.ok) return false;

    return true;
  } catch {
    return false;
  }
}

export async function getEmbeddingGemmaPipeline(onProgress, options = {}) {
  if (embeddingPipeline) return embeddingPipeline;
  if (isPipelineLoading || pipelineLoadAttempted) return null;

  try {
    isPipelineLoading = true;
    onProgress?.('Loading EmbeddingGemma 2 model from local storage...');
    const transformers = await loadTransformers();
    if (!transformers || !transformers.pipeline) {
      pipelineLoadAttempted = true;
      return null;
    }

    const basePath = options.localModelsPath || getLocalModelsPath() || '/models';

    // Strictly enforce LOCAL-ONLY loading: NEVER connect to Hugging Face
    if (transformers.env) {
      transformers.env.allowRemoteModels = false;
      transformers.env.allowLocalModels = true;
      transformers.env.localModelPath = basePath;
    }

    const modelTarget = options.modelId || 'embeddinggemma2';

    // Verify weights are available locally before initializing Transformers.js to avoid 404 noise and unhandled rejections
    const modelReady = options.forcePipeline || await isLocalModelReady(basePath, modelTarget);
    if (!modelReady) {
      pipelineLoadAttempted = true;
      return null;
    }

    try {
      embeddingPipeline = await transformers.pipeline('feature-extraction', modelTarget, {
        pooling: 'mean',
        normalize: true
      });
      return embeddingPipeline;
    } catch (localErr) {
      console.warn(`Local EmbeddingGemma 2 at ${basePath}/${modelTarget} not fully initialized (${localErr.message}), falling back to deterministic 768-dim embedding.`);
      pipelineLoadAttempted = true;
      return null;
    }
  } catch (err) {
    console.warn('EmbeddingGemma 2 pipeline init error:', err?.message || err);
    pipelineLoadAttempted = true;
    return null;
  } finally {
    isPipelineLoading = false;
  }
}

export function resetEmbeddingPipeline() {
  embeddingPipeline = null;
  transformersModule = null;
  isPipelineLoading = false;
  pipelineLoadAttempted = false;
}

export function generateHashEmbedding(text, dimension = 128) {
  if (!text || typeof text !== 'string') {
    return new Array(dimension).fill(0);
  }

  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 1);
  const embedding = new Array(dimension).fill(0);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash) + word.charCodeAt(j);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimension;
    embedding[idx] += 1;
  }

  const norm = Math.sqrt(embedding.reduce((sum, v) => sum + v * v, 0));
  if (norm > 0) {
    for (let i = 0; i < embedding.length; i++) {
      embedding[i] /= norm;
    }
  }

  return embedding;
}

export function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export async function generateEmbedding(text, options = {}) {
  const model = options.model || getEmbeddingModelName();

  if (model === 'hash') {
    return generateHashEmbedding(text, 128);
  }

  // Model: embeddinggemma2 (in-browser only)
  try {
    if (typeof window !== 'undefined') {
      const pipeline = await getEmbeddingGemmaPipeline(options.onProgress, options);
      if (pipeline) {
        const output = await pipeline(text);
        if (output && output.data) {
          const arr = Array.from(output.data);
          const norm = Math.sqrt(arr.reduce((sum, v) => sum + v * v, 0));
          return norm > 0 ? arr.map(v => v / norm) : arr;
        }
      }
    }
  } catch (err) {
    console.warn('EmbeddingGemma in-browser inference error, using 768-dim deterministic fallback:', err);
  }

  // EmbeddingGemma 2 default space: 768-dimensional normalized vector
  return generateHashEmbedding(text, 768);
}
