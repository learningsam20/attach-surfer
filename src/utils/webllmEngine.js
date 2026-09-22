import * as webllm from '@mlc-ai/web-llm';

let engineInstance = null;

export async function getWebLLMEngine(onProgress, modelId) {
  if (engineInstance) {
    return engineInstance;
  }

  const resolvedModel = modelId || import.meta.env.VITE_WEBLLM_MODEL || 'Phi-4-mini-instruct-q4f16_1-MLC';

  const engine = new webllm.MLCEngine();
  if (onProgress) {
    engine.setInitProgressCallback((report) => {
      onProgress(report.text);
    });
  }

  await engine.reload(resolvedModel);
  engineInstance = engine;

  if (typeof window !== 'undefined') {
    window.webllmEngine = engine;
  }

  return engine;
}

export function resetEngine() {
  engineInstance = null;
}
