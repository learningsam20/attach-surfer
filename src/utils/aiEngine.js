import { getWebLLMEngine } from './webllmEngine';

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

export function cleanProgressMessage(message) {
  if (!message || typeof message !== 'string') return 'Processing with AI...';

  // If message contains percentage e.g. "Loading model: 45%" or "[3/5] 45%"
  const percentMatch = message.match(/(\d{1,3})%/);
  if (percentMatch) {
    return `Loading AI engine: ${percentMatch[1]}%`;
  }

  // Strip technical model names and framework tokens
  let clean = message
    .replace(/\b(gemma-?2?-?4?b?-?it?[a-z0-9_-]*|phi-?4?[a-z0-9_-]*|embeddinggemma[0-9]*)\b/gi, 'AI model')
    .replace(/\b(Transformers\.js|LiteRT-LM|LiteRT|WebLLM|ONNX|WebGPU)\b/gi, 'in-browser AI')
    .replace(/\[WebLLM\]\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (/loading|fetching|init|download/i.test(clean)) {
    return 'Initializing AI engine...';
  }
  if (/generating|synthesiz|summariz|condens/i.test(clean)) {
    return 'Generating AI summary...';
  }

  return clean || 'Processing with AI...';
}

export function getAIModelConfig() {
  const saved = getSavedConfig();
  return {
    aiModel: saved?.aiModel || import.meta.env.VITE_AI_MODEL || 'gemma4',
    embeddingModel: saved?.embeddingModel || import.meta.env.VITE_EMBEDDING_MODEL || 'embeddinggemma2',
    aiBackend: saved?.aiBackend || import.meta.env.VITE_AI_BACKEND || 'auto',
    webllmModel: saved?.webllmModel || import.meta.env.VITE_WEBLLM_MODEL || 'Phi-4-mini-instruct-q4f16_1-MLC',
    gemmaModel: saved?.gemmaModel || import.meta.env.VITE_GEMMA_MODEL || 'gemma-4-E2B-it-web',
    localModelsPath: saved?.localModelsPath || import.meta.env.VITE_LOCAL_MODELS_PATH || '/models'
  };
}

let liteRTModule = null;
let liteRTEngineInstance = null;
let transformersModule = null;
let gemmaPipelineInstance = null;

export async function loadLiteRTLM() {
  if (liteRTModule) return liteRTModule;
  if (typeof window !== 'undefined' && (window.liteRT || window.LiteRTLM)) {
    liteRTModule = window.liteRT || window.LiteRTLM;
    return liteRTModule;
  }
  return null;
}

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
        console.warn('Transformers.js runtime not available:', cdnErr);
      }
    }
    return null;
  }
}

export async function generateGemmaWithLiteRT({ prompt, systemPrompt, onProgress, modelId, localModelsPath }) {
  const litert = await loadLiteRTLM();
  if (!litert || !litert.Engine) {
    throw new Error('LiteRT-LM runtime not available in this environment');
  }

  onProgress?.('Initializing in-browser AI engine...');
  const config = getAIModelConfig();
  const basePath = localModelsPath || config.localModelsPath || '/models';
  const targetModel = modelId || `${basePath}/gemma4/gemma-4-E2B-it-web.litertlm`;

  if (!liteRTEngineInstance) {
    liteRTEngineInstance = await litert.Engine.create({
      model: targetModel,
      progress: (p) => onProgress?.(`Loading AI engine: ${Math.round(p * 100)}%`)
    });
  }

  onProgress?.('Generating AI summary...');
  const conversation = await liteRTEngineInstance.createConversation({
    systemPrompt: systemPrompt || 'You are a helpful research assistant.'
  });

  let fullResponse = '';
  for await (const chunk of conversation.sendMessageStreaming(prompt)) {
    if (chunk?.content?.[0]?.text) {
      fullResponse += chunk.content[0].text;
    }
  }

  return fullResponse || 'Unable to generate summary with Gemma 4.';
}

export async function isTransformersGemmaReady(basePath, modelTarget = 'gemma4') {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return false;
  try {
    const cleanBase = basePath.replace(/\/+$/, '');
    const manifestRes = await fetch(`${cleanBase}/${modelTarget}/model_manifest.json`);
    if (manifestRes.ok) {
      const manifest = await manifestRes.json();
      if (manifest && manifest.hasWeights === false) return false;
      if (manifest && manifest.hasWeights === true) return true;
    }

    const onnxRes = await fetch(`${cleanBase}/${modelTarget}/onnx/decoder_model_merged_q4.onnx`, { method: 'HEAD' });
    if (!onnxRes.ok) return false;

    const dataRes = await fetch(`${cleanBase}/${modelTarget}/onnx/decoder_model_merged_q4.onnx_data`, { method: 'HEAD' });
    if (!dataRes.ok) return false;

    return true;
  } catch {
    return false;
  }
}

export async function generateGemmaWithTransformers({ prompt, systemPrompt, onProgress, modelId, localModelsPath, maxTokens, temperature, options = {} }) {
  const transformers = await loadTransformers();
  if (!transformers || !transformers.pipeline) {
    throw new Error('Transformers.js runtime not available in this environment');
  }

  const config = getAIModelConfig();
  const basePath = localModelsPath || config.localModelsPath || '/models';
  const targetModel = 'gemma4';

  // Check if local ONNX files exist before calling pipeline to prevent 404 spam and unhandled promise rejections
  const isReady = options.forcePipeline || await isTransformersGemmaReady(basePath, targetModel);
  if (!isReady) {
    throw new Error(`Local Transformers.js ONNX weights not found for ${targetModel} at ${basePath}/${targetModel}/onnx`);
  }

  onProgress?.('Initializing in-browser AI engine...');

  // Strictly enforce LOCAL-ONLY loading: NEVER connect to Hugging Face
  if (transformers.env) {
    transformers.env.allowRemoteModels = false;
    transformers.env.allowLocalModels = true;
    transformers.env.localModelPath = basePath;
  }

  if (!gemmaPipelineInstance) {
    try {
      gemmaPipelineInstance = await transformers.pipeline('text-generation', targetModel, {
        device: 'webgpu',
        dtype: 'q4'
      });
    } catch (localErr) {
      console.warn(`Local model not available at ${basePath}/${targetModel}:`, localErr.message);
      throw localErr;
    }
  }

  onProgress?.('Generating AI summary...');
  const messages = [
    { role: 'system', content: systemPrompt || 'You are a helpful research assistant.' },
    { role: 'user', content: prompt }
  ];

  const output = await gemmaPipelineInstance(messages, {
    max_new_tokens: maxTokens || 1200,
    temperature: temperature || 0.3
  });

  if (Array.isArray(output) && output[0]?.generated_text) {
    const text = output[0].generated_text;
    if (Array.isArray(text)) {
      return text[text.length - 1]?.content || 'Summary generated.';
    }
    return String(text);
  }

  return 'Unable to generate summary with AI.';
}

export function guardPromptTokens(prompt, maxRequestedTokens = 1200, contextWindow = 4096) {
  if (!prompt || typeof prompt !== 'string') return prompt;

  const reservedOutputTokens = Math.min(maxRequestedTokens || 1200, 1200);
  const maxAllowedPromptTokens = Math.max(contextWindow - reservedOutputTokens - 250, 1000);
  const maxAllowedChars = Math.floor(maxAllowedPromptTokens * 3.5);

  if (prompt.length > maxAllowedChars) {
    console.warn(`[AttachSurfer] Prompt of ${prompt.length} chars exceeds safe context budget (~${maxAllowedPromptTokens} tokens). Truncating safely.`);
    return prompt.slice(0, maxAllowedChars) + '\n\n[... content truncated to preserve context window ...]';
  }
  return prompt;
}

export async function generateGemmaWithWebLLM({ prompt, systemPrompt, onProgress, maxTokens, temperature, localModelsPath }) {
  onProgress?.('Preparing in-browser AI engine...');
  const config = getAIModelConfig();
  const basePath = localModelsPath || config.localModelsPath;
  const engine = await getWebLLMEngine((progress) => {
    onProgress?.(cleanProgressMessage(progress));
  }, 'gemma-2-2b-it-q4f16_1-MLC', {
    localModelsPath: basePath ? `${basePath}/gemma4` : null
  });

  const guardedPrompt = guardPromptTokens(prompt, maxTokens || 1200, 4096);
  const promptTokensEst = Math.ceil((guardedPrompt.length + (systemPrompt?.length || 50)) / 3.5);
  const safeMaxTokens = Math.min(maxTokens || 1200, Math.max(200, 4096 - promptTokensEst - 50));

  const response = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful research assistant.' },
      { role: 'user', content: guardedPrompt }
    ],
    temperature: temperature || 0.3,
    max_tokens: safeMaxTokens
  });

  return response.choices[0]?.message?.content || 'Unable to generate summary with Gemma.';
}

export async function generateGemmaCompletion({ prompt, systemPrompt, onProgress, maxTokens, temperature, modelId, backend = 'auto', localModelsPath }) {
  // 1. If backend explicitly specified as litert-lm:
  if (backend === 'litert-lm') {
    return await generateGemmaWithLiteRT({ prompt, systemPrompt, onProgress, modelId, localModelsPath });
  }

  // 2. If backend explicitly specified as transformers:
  if (backend === 'transformers') {
    return await generateGemmaWithTransformers({ prompt, systemPrompt, onProgress, modelId, localModelsPath, maxTokens, temperature });
  }

  // 3. Auto mode: check availability quietly to avoid console noise and failed requests
  const litert = await loadLiteRTLM();
  if (litert && litert.Engine) {
    try {
      return await generateGemmaWithLiteRT({ prompt, systemPrompt, onProgress, modelId, localModelsPath });
    } catch {
      // fallback
    }
  }

  const config = getAIModelConfig();
  const basePath = localModelsPath || config.localModelsPath || '/models';
  const transformersReady = await isTransformersGemmaReady(basePath, 'gemma4');
  if (transformersReady) {
    try {
      return await generateGemmaWithTransformers({ prompt, systemPrompt, onProgress, modelId, localModelsPath, maxTokens, temperature });
    } catch {
      // fallback
    }
  }

  return await generateGemmaWithWebLLM({ prompt, systemPrompt, onProgress, maxTokens, temperature, localModelsPath });
}

export async function generateAICompletion({ model, prompt, systemPrompt, onProgress, maxTokens, temperature, options = {} }) {
  const config = getAIModelConfig();
  const selectedModel = model || config.aiModel;
  const backend = options.backend || config.aiBackend;
  const localModelsPath = options.localModelsPath || config.localModelsPath;

  if (selectedModel === 'gemma4' || selectedModel === 'gemma') {
    return await generateGemmaCompletion({
      prompt,
      systemPrompt,
      onProgress,
      maxTokens,
      temperature,
      modelId: options.gemmaModel || config.gemmaModel,
      backend,
      localModelsPath
    });
  }

  // Default: Phi-4 via WebLLM
  const engine = await getWebLLMEngine((progress) => {
    onProgress?.(progress);
  }, options.webllmModel || config.webllmModel, {
    localModelsPath: localModelsPath ? `${localModelsPath}/phi4` : null
  });

  const guardedPrompt = guardPromptTokens(prompt, maxTokens || 1500, 4096);
  const promptTokensEst = Math.ceil((guardedPrompt.length + (systemPrompt?.length || 50)) / 3.5);
  const safeMaxTokens = Math.min(maxTokens || 1500, Math.max(200, 4096 - promptTokensEst - 50));

  const response = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful research assistant.' },
      { role: 'user', content: guardedPrompt }
    ],
    temperature: temperature || 0.3,
    max_tokens: safeMaxTokens
  });

  return response.choices[0]?.message?.content || 'Unable to generate summary.';
}

export function resetAIEngines() {
  liteRTEngineInstance = null;
  gemmaPipelineInstance = null;
}
