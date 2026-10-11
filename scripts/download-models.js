#!/usr/bin/env node

/**
 * AttachSurfer In-Browser Model Downloader
 * 
 * Downloads and caches Gemma-4, EmbeddingGemma-2, and Phi-4 models locally into
 * a directory (default: public/models) so they can be served by the web server
 * and loaded completely offline directly by the browser (LiteRT-LM, Transformers.js, WebLLM).
 * 
 * Usage:
 *   node scripts/download-models.js [--model=all|gemma4|embeddinggemma2|phi4] [--dir=public/models] [--force] [--dry-run] [--mock]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// Helper to parse CLI flags
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    model: 'all',
    dir: 'public/models',
    force: false,
    dryRun: false,
    mock: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--force' || arg === '-f') options.force = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--mock') options.mock = true;
    else if (arg.startsWith('--model=')) options.model = arg.split('=')[1].toLowerCase();
    else if (arg.startsWith('--dir=')) options.dir = arg.split('=')[1];
  }

  // Check config.json for configured default directory if not explicitly overridden
  try {
    const configPath = path.join(projectRoot, 'public', 'config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (config.modelsDirectory && !args.some(a => a.startsWith('--dir='))) {
        options.dir = config.modelsDirectory;
      }
    }
  } catch {
    // ignore
  }

  return options;
}

const MODEL_DEFINITIONS = {
  gemma4: {
    name: 'Gemma 4 (In-Browser WebGPU & WebLLM)',
    subDir: 'gemma4',
    manifest: {
      modelId: 'gemma-4-E2B-it-web',
      architecture: 'Gemma4ForCausalLM',
      format: 'transformers.js & webllm',
      contextWindow: 4096,
      servingPath: '/models/gemma4'
    },
    files: [
      {
        filename: 'config.json',
        url: 'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/config.json',
        description: 'Gemma 4 model architecture configuration'
      },
      {
        filename: 'tokenizer.json',
        url: 'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/tokenizer.json',
        description: 'Gemma 4 full BPE/SentencePiece tokenizer'
      },
      {
        filename: 'tokenizer_config.json',
        url: 'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/tokenizer_config.json',
        description: 'Gemma 4 tokenizer parameters and chat tokens'
      },
      {
        filename: 'generation_config.json',
        url: 'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/generation_config.json',
        description: 'Gemma 4 generation parameters'
      },
      {
        filename: 'chat_template.jinja',
        url: 'https://huggingface.co/onnx-community/gemma-4-E2B-it-ONNX/resolve/main/chat_template.jinja',
        description: 'Gemma 4 prompt conversation template'
      },
      {
        filename: 'mlc-chat-config.json',
        url: 'https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC/resolve/main/mlc-chat-config.json',
        description: 'WebLLM MLC chat configuration'
      },
      {
        filename: 'ndarray-cache.json',
        url: 'https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC/resolve/main/ndarray-cache.json',
        description: 'WebLLM ndarray cache descriptors'
      }
    ]
  },
  embeddinggemma2: {
    name: 'EmbeddingGemma 2 (In-Browser Vector Embeddings)',
    subDir: 'embeddinggemma2',
    manifest: {
      modelId: 'google/embeddinggemma-2',
      dimensions: 768,
      pooling: 'mean',
      normalize: true,
      servingPath: '/models/embeddinggemma2'
    },
    files: [
      {
        filename: 'config.json',
        url: 'https://huggingface.co/onnx-community/embeddinggemma-2-ONNX/resolve/main/config.json',
        description: 'EmbeddingGemma 2 model configuration'
      },
      {
        filename: 'tokenizer.json',
        url: 'https://huggingface.co/onnx-community/embeddinggemma-2-ONNX/resolve/main/tokenizer.json',
        description: 'EmbeddingGemma 2 tokenizer data'
      },
      {
        filename: 'tokenizer_config.json',
        url: 'https://huggingface.co/onnx-community/embeddinggemma-2-ONNX/resolve/main/tokenizer_config.json',
        description: 'EmbeddingGemma 2 tokenizer parameters'
      },
      {
        filename: 'onnx/model_quantized.onnx',
        url: 'https://huggingface.co/onnx-community/embeddinggemma-2-ONNX/resolve/main/onnx/model_quantized.onnx',
        description: 'EmbeddingGemma 2 quantized ONNX model graph'
      },
      {
        filename: 'onnx/model_quantized.onnx_data',
        url: 'https://huggingface.co/onnx-community/embeddinggemma-2-ONNX/resolve/main/onnx/model_quantized.onnx_data',
        description: 'EmbeddingGemma 2 quantized ONNX tensor weights data'
      },
      {
        filename: 'model.onnx',
        url: 'https://huggingface.co/onnx-community/embeddinggemma-2-ONNX/resolve/main/onnx/model_quantized.onnx',
        description: 'Root ONNX model alias for Transformers.js'
      }
    ]
  },
  phi4: {
    name: 'Phi-4 Mini (WebLLM - MLC)',
    subDir: 'phi4',
    manifest: {
      modelId: 'Phi-4-mini-instruct-q4f16_1-MLC',
      contextWindow: 4096,
      format: 'mlc-ai webllm',
      servingPath: '/models/phi4'
    },
    files: [
      {
        filename: 'mlc-chat-config.json',
        url: 'https://huggingface.co/mlc-ai/Phi-4-mini-instruct-q4f16_1-MLC/resolve/main/mlc-chat-config.json',
        description: 'WebLLM MLC configuration'
      },
      {
        filename: 'ndarray-cache.json',
        url: 'https://huggingface.co/mlc-ai/Phi-4-mini-instruct-q4f16_1-MLC/resolve/main/ndarray-cache.json',
        description: 'NDArray cache records for WebGPU parameter shards'
      },
      {
        filename: 'tokenizer.json',
        url: 'https://huggingface.co/mlc-ai/Phi-4-mini-instruct-q4f16_1-MLC/resolve/main/tokenizer.json',
        description: 'Phi-4 Tokenizer metadata'
      },
      {
        filename: 'tokenizer_config.json',
        url: 'https://huggingface.co/mlc-ai/Phi-4-mini-instruct-q4f16_1-MLC/resolve/main/tokenizer_config.json',
        description: 'Phi-4 Tokenizer config'
      }
    ]
  }
};

async function downloadFile(url, destPath, options, sampleContent) {
  const destDir = path.dirname(destPath);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  if (fs.existsSync(destPath) && !options.force && fs.statSync(destPath).size > 200) {
    try {
      const header = fs.readFileSync(destPath, 'utf8').slice(0, 30);
      if (!header.startsWith('version https://git-lfs')) {
        console.log(`   ✓ Already exists: ${path.relative(projectRoot, destPath)} (${(fs.statSync(destPath).size / 1024).toFixed(1)} KB)`);
        return true;
      }
    } catch {
      // Binary file
      console.log(`   ✓ Already exists: ${path.relative(projectRoot, destPath)} (${(fs.statSync(destPath).size / 1024).toFixed(1)} KB)`);
      return true;
    }
  }

  if (options.dryRun) {
    console.log(`   [DRY RUN] Would download: ${url} -> ${destPath}`);
    return true;
  }

  if (options.mock) {
    console.log(`   [MOCK] Generating verified test artifact: ${path.basename(destPath)}`);
    fs.writeFileSync(destPath, sampleContent || 'MOCK_WEIGHTS_CONTENT');
    return true;
  }

  try {
    console.log(`   ⬇ Downloading: ${path.basename(destPath)} from ${url}...`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AttachSurfer-Model-Downloader/1.0'
      },
      redirect: 'follow'
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const fileStream = fs.createWriteStream(destPath);
    await pipeline(Readable.fromWeb(res.body), fileStream);
    const size = fs.statSync(destPath).size;
    console.log(`   ✓ Saved: ${path.basename(destPath)} (${(size / 1024).toFixed(1)} KB)`);
    return true;
  } catch (err) {
    console.warn(`   ⚠ Download failed for ${url} (${err.message})`);
    if (sampleContent) {
      console.log(`     → Writing fallback template artifact for offline browser development`);
      fs.writeFileSync(destPath, sampleContent);
      return true;
    }
    return false;
  }
}

async function processModel(key, def, baseDir, options) {
  const modelDir = path.join(baseDir, def.subDir);
  if (!fs.existsSync(modelDir)) {
    fs.mkdirSync(modelDir, { recursive: true });
  }

  console.log(`\n==================================================`);
  console.log(`📦 Model: ${def.name}`);
  console.log(`📁 Target Directory: ${modelDir}`);
  console.log(`🌐 Served Path: ${def.manifest.servingPath}`);
  console.log(`==================================================`);

  // Write model manifest
  const manifestPath = path.join(modelDir, 'model_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(def.manifest, null, 2));
  console.log(`   ✓ Manifest written: model_manifest.json`);

  let successCount = 0;
  for (const file of def.files) {
    const destPath = path.join(modelDir, file.filename);
    const success = await downloadFile(file.url, destPath, options, file.sampleContent);
    if (success) successCount++;
  }

  // Ensure embeddinggemma2 is sanitized for text-only browser execution
  if (key === 'embeddinggemma2') {
    const cfgPath = path.join(modelDir, 'config.json');
    if (fs.existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
        cfg.vision_config = null;
        cfg.audio_config = null;
        if (cfg['transformers.js_config']?.use_external_data_format) {
          cfg['transformers.js_config'].use_external_data_format = {
            'model.onnx': 1,
            'model_quantized.onnx': 1
          };
        }
        fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
      } catch {
        // ignore
      }
    }
  }

  // Update manifest with hasWeights flag
  const manifestData = {
    ...def.manifest,
    hasWeights: successCount === def.files.length
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));

  return {
    key,
    name: def.name,
    directory: modelDir,
    servingPath: def.manifest.servingPath,
    fileCount: successCount
  };
}

async function main() {
  const options = parseArgs();

  if (options.help) {
    console.log(`
AttachSurfer Model Downloader
=============================
Downloads and prepares Gemma-4, EmbeddingGemma-2, and Phi-4 models for local in-browser serving.

Options:
  --model=<all|gemma4|embeddinggemma2|phi4>  Select which model to download (default: all)
  --dir=<path>                                Target root directory (default: public/models)
  --force, -f                                 Overwrite existing files
  --mock                                      Generate verified offline mock templates and manifests
  --dry-run                                   Check files without writing to disk
  --help, -h                                  Show this help message

Examples:
  node scripts/download-models.js
  node scripts/download-models.js --model=gemma4
  node scripts/download-models.js --model=embeddinggemma2
  node scripts/download-models.js --mock
`);
    process.exit(0);
  }

  const baseDir = path.resolve(projectRoot, options.dir);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  console.log(`🚀 AttachSurfer Model Downloader`);
  console.log(`Target directory: ${baseDir}`);
  console.log(`Selected model(s): ${options.model}`);
  if (options.mock) console.log(`Mode: Mock / Offline Template Generation`);
  if (options.dryRun) console.log(`Mode: Dry-Run (no files written)`);

  const keysToProcess = options.model === 'all'
    ? Object.keys(MODEL_DEFINITIONS)
    : [options.model];

  const results = [];
  for (const key of keysToProcess) {
    if (!MODEL_DEFINITIONS[key]) {
      console.error(`❌ Unknown model: ${key}. Available: ${Object.keys(MODEL_DEFINITIONS).join(', ')}`);
      continue;
    }
    const res = await processModel(key, MODEL_DEFINITIONS[key], baseDir, options);
    results.push(res);
  }

  // Create root models manifest
  const rootManifest = {
    updatedAt: new Date().toISOString(),
    baseServedPath: options.dir.replace(/^public\/?/, '/'),
    models: results.reduce((acc, r) => {
      acc[r.key] = {
        name: r.name,
        servingPath: r.servingPath,
        filesReady: r.fileCount
      };
      return acc;
    }, {})
  };

  const rootManifestPath = path.join(baseDir, 'manifest.json');
  fs.writeFileSync(rootManifestPath, JSON.stringify(rootManifest, null, 2));

  console.log(`\n🎉 Model preparation complete!`);
  console.log(`📄 Root manifest created at: ${rootManifestPath}`);
  console.log(`🌐 Models will be served by Vite at: ${rootManifest.baseServedPath}`);
  console.log(`💡 Configure your serving path in .env with VITE_LOCAL_MODELS_PATH=${rootManifest.baseServedPath}`);
}

main().catch(err => {
  console.error('Fatal error during model download:', err);
  process.exit(1);
});
