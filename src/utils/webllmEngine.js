import * as webllm from '@mlc-ai/web-llm';

let engineInstance = null;
let currentModelId = null;

export async function getWebLLMEngine(onProgress, modelId, options = {}) {
  const resolvedModel = modelId || import.meta.env.VITE_WEBLLM_MODEL || 'Phi-4-mini-instruct-q4f16_1-MLC';
  if (engineInstance && currentModelId === resolvedModel) {
    return engineInstance;
  }
  const localModelsPath = options?.localModelsPath || import.meta.env.VITE_LOCAL_MODELS_PATH;

  const engine = new webllm.MLCEngine();
  if (onProgress) {
    engine.setInitProgressCallback((report) => {
      onProgress(report.text);
    });
  }

  let appConfig = options?.appConfig;
  if (!appConfig && localModelsPath) {
    const modelUrl = localModelsPath.endsWith('/') ? `${localModelsPath}` : `${localModelsPath}/`;
    appConfig = {
      model_list: [
        {
          model_url: modelUrl,
          model_id: resolvedModel,
          low_resource_required: true
        }
      ]
    };
  }

  try {
    if (appConfig) {
      await engine.reload(resolvedModel, { appConfig });
    } else {
      await engine.reload(resolvedModel);
    }
  } catch (err) {
    if (appConfig) {
      console.warn(`Local model reload failed from ${localModelsPath}, falling back to standard CDN:`, err);
      await engine.reload(resolvedModel);
    } else {
      throw err;
    }
  }

  engineInstance = engine;
  currentModelId = resolvedModel;

  if (typeof window !== 'undefined') {
    window.webllmEngine = engine;
  }

  return engine;
}

export function resetEngine() {
  engineInstance = null;
  currentModelId = null;
}
