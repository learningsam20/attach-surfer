import { getWebLLMEngine } from '../utils/webllmEngine';
import { generateGemmaCompletion, getAIModelConfig, cleanProgressMessage } from '../utils/aiEngine';

/**
 * Approximate token estimator (conservative: ~3.5 chars per token for typical markdown/web text).
 */
export function estimateTokenCount(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / 3.5);
}

// Maximum safe prompt length for a 4096 token context window (leaving ~1500 tokens for generation & system prompt)
const MAX_SAFE_PROMPT_CHARS = 6500;
const MAX_CHUNK_CHARS = 4000;

/**
 * Prepares a concise, high-signal extract for a search result item.
 * Preserves key introductory thesis, structural headers, and conclusions without blowing token budget.
 */
export function prepareResultExtract(result, contentObj, maxChars = 2200) {
  const title = result.title || 'Search Result';
  const source = result.url || '';
  const engine = result.engine || '';
  const rawText = contentObj?.success ? contentObj.markdown : (result.snippet || '');

  if (!rawText || rawText.length <= maxChars) {
    return `### ${title}\n**Source:** ${source} (${engine})\n\n${rawText || '*(No content)*'}`;
  }

  // Multi-page document or large page: extract opening context, headings/bullets, and conclusion
  const intro = rawText.slice(0, 1100).trim();
  const conclusion = rawText.length > 1800 ? rawText.slice(-600).trim() : '';

  // Extract major headers / key bullets from the middle body
  const middleLines = rawText
    .slice(1100, Math.min(rawText.length - 600, 15000))
    .split('\n')
    .filter(line => line.startsWith('### ') || line.startsWith('## ') || line.startsWith('- ') || line.startsWith('* '))
    .slice(0, 5)
    .join('\n');

  let extracted = `### ${title}\n**Source:** ${source} (${engine})\n\n${intro}`;
  if (middleLines) {
    extracted += `\n\n**Key Highlights:**\n${middleLines}`;
  }
  if (conclusion) {
    extracted += `\n\n**Conclusion:**\n${conclusion}`;
  }
  return extracted;
}

/**
 * Shared LLM completion invoker supporting Gemma (LiteRT/Transformers/WebLLM) and Phi-4 (WebLLM).
 */
async function callLLM({ promptText, systemPrompt, onProgress, stageProgress, config, maxTokens = 800 }) {
  if (stageProgress) onProgress?.(stageProgress);

  const forwardProgress = (p) => {
    onProgress?.(cleanProgressMessage(p));
  };

  if (config.aiModel === 'gemma4' || config.aiModel === 'gemma') {
    return await generateGemmaCompletion({
      prompt: promptText,
      systemPrompt: systemPrompt || 'You are a helpful research assistant. Provide clear, accurate summaries in markdown.',
      onProgress: forwardProgress,
      modelId: config.gemmaModel,
      backend: config.aiBackend,
      localModelsPath: config.localModelsPath,
      temperature: 0.3,
      maxTokens
    });
  }

  // Default: Phi-4 via WebLLM
  const engine = await getWebLLMEngine((progress) => {
    forwardProgress(progress);
  }, config.webllmModel, {
    localModelsPath: config.localModelsPath ? `${config.localModelsPath}/phi4` : null
  });

  const response = await engine.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt || 'You are a helpful research assistant.' },
      { role: 'user', content: promptText }
    ],
    temperature: 0.3,
    max_tokens: maxTokens
  });

  return response.choices[0]?.message?.content || '';
}

/**
 * Recursively reduces an array of distilled summary notes until they fit safely in a single prompt.
 */
async function recursivelyReduceNotes(notes, contextTitle, onProgress, config, depth = 1) {
  const combined = notes.join('\n\n');
  if (combined.length <= MAX_SAFE_PROMPT_CHARS || notes.length <= 2) {
    return notes;
  }

  onProgress?.(`Condensing large findings (pass ${depth})...`);
  const groupedBatches = [];
  const batchSize = 3;

  for (let i = 0; i < notes.length; i += batchSize) {
    groupedBatches.push(notes.slice(i, i + batchSize));
  }

  const reducedNotes = [];
  for (let i = 0; i < groupedBatches.length; i++) {
    const batchText = groupedBatches[i].join('\n\n---\n\n');
    const reducePrompt = `The following are extracted points from multiple sections of "${contextTitle}". Condense and synthesize them into 3-4 high-impact, non-redundant bullet points preserving all key data:\n\n${batchText}`;
    const reduced = await callLLM({
      promptText: reducePrompt,
      systemPrompt: 'You are an expert summarizer. Synthesize findings concisely without losing factual data.',
      onProgress,
      stageProgress: `Condensing section notes (${i + 1}/${groupedBatches.length})...`,
      config,
      maxTokens: 350
    });
    if (reduced && reduced.trim()) {
      reducedNotes.push(reduced.trim());
    }
  }

  // Recursive step if still over safe token limit
  return await recursivelyReduceNotes(reducedNotes, contextTitle, onProgress, config, depth + 1);
}

/**
 * Generates an AI summary of search results using hierarchical map-reduce and recursive compression.
 */
export async function generateSummary(results, contents, onProgress, options = {}) {
  if (!results || results.length === 0) {
    return 'No search results to summarize.';
  }

  onProgress?.('Generating summary with AI...');

  const config = { ...getAIModelConfig(), ...options };
  const systemPrompt = 'You are a helpful research assistant. Analyze search results and provide clear, accurate summaries. Use markdown formatting with headers, bullet points, and emphasis where appropriate. Be concise but thorough.';

  try {
    // 1. Distill each result item
    const distilledExtracts = results.map((r, i) => {
      const content = contents?.[r.url];
      return prepareResultExtract(r, content, 2000);
    });

    const totalChars = distilledExtracts.reduce((acc, str) => acc + str.length, 0);

    // 2. Direct single-pass synthesis if content comfortably fits within context budget
    if (totalChars <= MAX_SAFE_PROMPT_CHARS) {
      const sections = distilledExtracts.map((text, i) => `## Result ${i + 1}\n${text}`).join('\n\n---\n\n');
      const prompt = `Based on the following search results, provide a comprehensive summary. Combine the key information from all sources, highlight the most important points, and present a cohesive overview. If there are conflicting pieces of information, note them.\n\n${sections}\n\n---\n\nProvide a well-structured summary with clear sections and bullet points where appropriate.`;

      const result = await callLLM({
        promptText: prompt,
        systemPrompt,
        onProgress,
        stageProgress: 'Synthesizing search summary...',
        config,
        maxTokens: 1200
      });

      return result || 'Unable to generate summary.';
    }

    // 3. Hierarchical Map-Reduce Strategy for Large Search Result Sets
    onProgress?.(`Processing large result set across ${results.length} sources...`);
    const batches = [];
    let currentBatch = [];
    let currentBatchLen = 0;

    for (let i = 0; i < distilledExtracts.length; i++) {
      const item = distilledExtracts[i];
      if ((currentBatchLen + item.length > 3800 || currentBatch.length >= 3) && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [item];
        currentBatchLen = item.length;
      } else {
        currentBatch.push(item);
        currentBatchLen += item.length;
      }
    }
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    // Map Phase: extract key points from each batch
    const intermediateNotes = [];
    for (let i = 0; i < batches.length; i++) {
      const batchContent = batches[i].join('\n\n---\n\n');
      const mapPrompt = `Analyze the following search result sources (Batch ${i + 1} of ${batches.length}). Extract 2-3 essential key points, data, and findings from each source:\n\n${batchContent}`;

      const batchSummary = await callLLM({
        promptText: mapPrompt,
        systemPrompt,
        onProgress,
        stageProgress: `Analyzing sources (batch ${i + 1} of ${batches.length})...`,
        config,
        maxTokens: 400
      });

      if (batchSummary && batchSummary.trim()) {
        intermediateNotes.push(`### Sources Batch ${i + 1}\n${batchSummary.trim()}`);
      }
    }

    // Recursive Reduction Phase if notes are still large
    const finalNotes = await recursivelyReduceNotes(intermediateNotes, 'Search Results', onProgress, config);

    // Synthesis Phase
    onProgress?.('Synthesizing comprehensive summary across all sources...');
    const synthesisPrompt = `Below are the distilled key findings from ${results.length} search results:\n\n${finalNotes.join('\n\n---\n\n')}\n\n---\n\nBased on all sources above, provide a comprehensive, well-structured executive synthesis with:\n- **Overview**: High-level synthesis of the topic\n- **Key Insights & Evidence**: Bullet points covering the most important points\n- **Consensus & Perspectives**: Key areas of consensus or notable differences\n- **Takeaways & Conclusions**`;

    const finalSummary = await callLLM({
      promptText: synthesisPrompt,
      systemPrompt,
      onProgress,
      stageProgress: 'Finalizing summary across all sources...',
      config,
      maxTokens: 1200
    });

    return finalSummary || 'Unable to generate summary.';
  } catch (err) {
    console.error('Summary generation failed:', err);
    throw new Error(`Summary generation failed: ${err.message}`, { cause: err });
  }
}

/**
 * Splits document text into semantically cohesive chunks with slight boundary overlap.
 */
export function chunkDocumentText(text, maxChunkLength = MAX_CHUNK_CHARS) {
  if (!text || text.length <= maxChunkLength) {
    return [text];
  }

  // Split on page headers, major markdown headers, or double newlines
  const parts = text.split(/(?=\n### Page |\n## |\n# |\n\n)/g);
  const chunks = [];
  let current = '';

  for (const part of parts) {
    if ((current + part).length > maxChunkLength && current.trim()) {
      chunks.push(current.trim());
      // Keep a short 150-char overlap from previous chunk for narrative continuity
      const overlap = current.length > 200 ? current.slice(-150) + '\n\n' : '';
      current = overlap + part;
    } else {
      current += part;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  // If extremely large (e.g. 50+ chunks), sample key representative sections across document
  // to avoid browser GPU memory exhaustion while ensuring end-to-end document coverage
  if (chunks.length > 8) {
    const selected = [
      chunks[0],
      chunks[1],
      chunks[Math.floor(chunks.length * 0.25)],
      chunks[Math.floor(chunks.length * 0.5) - 1],
      chunks[Math.floor(chunks.length * 0.5)],
      chunks[Math.floor(chunks.length * 0.75)],
      chunks[chunks.length - 2],
      chunks[chunks.length - 1]
    ];
    return selected.filter(Boolean);
  }

  return chunks;
}

/**
 * Generates an executive summary of a single document using hierarchical map-reduce.
 */
export async function generateDocumentSummary(documentText, filename = 'Document', onProgress, options = {}) {
  if (!documentText || !documentText.trim()) {
    return 'No document content available to summarize.';
  }

  onProgress?.('Generating AI summary for document...');

  const chunks = chunkDocumentText(documentText.trim());
  const config = { ...getAIModelConfig(), ...options };
  const systemPrompt = 'You are an expert document analyst. Provide an executive summary of the document, highlighting key points, takeaways, and conclusions using clean markdown.';

  try {
    // 1. Single Chunk (Standard Size)
    if (chunks.length === 1) {
      onProgress?.('Generating comprehensive AI summary...');
      const prompt = `Please provide a clear, concise, and well-structured executive summary of the following document ("${filename}"). Highlight the main themes, key findings, and actionable takeaways using bullet points:\n\n${chunks[0]}`;
      return await callLLM({
        promptText: prompt,
        systemPrompt,
        onProgress,
        stageProgress: 'Generating executive summary...',
        config,
        maxTokens: 1000
      });
    }

    // 2. Multi-Chunk Strategy for Large Documents: Map-Reduce
    onProgress?.(`Processing large document in ${chunks.length} sections...`);
    const sectionalSummaries = [];

    for (let i = 0; i < chunks.length; i++) {
      const sectionProgress = `Analyzing section ${i + 1} of ${chunks.length}...`;
      const sectionPrompt = `You are analyzing Section ${i + 1} of "${filename}". Extract the key points, evidence, and data from this section into 2-3 concise bullets:\n\n${chunks[i]}`;
      const sectionResult = await callLLM({
        promptText: sectionPrompt,
        systemPrompt,
        onProgress,
        stageProgress: sectionProgress,
        config,
        maxTokens: 350
      });
      if (sectionResult && sectionResult.trim()) {
        sectionalSummaries.push(`### Section ${i + 1}\n${sectionResult.trim()}`);
      }
    }

    // Recursive Reduction if sectional notes are too large
    const reducedNotes = await recursivelyReduceNotes(sectionalSummaries, filename, onProgress, config);

    // Stage 2: Synthesis
    onProgress?.('Synthesizing final executive summary from all sections...');
    const synthesisPrompt = `The document "${filename}" contains ${chunks.length} sections. Below are the key findings distilled from all sections:\n\n${reducedNotes.join('\n\n')}\n\nBased on all sections above, provide a comprehensive executive summary structured with:\n- **Executive Overview**: High-level purpose and thesis\n- **Key Findings & Evidence**: Bullet points covering the whole document\n- **Conclusions & Takeaways**: Final insights`;

    const finalSummary = await callLLM({
      promptText: synthesisPrompt,
      systemPrompt,
      onProgress,
      stageProgress: 'Finalizing summary...',
      config,
      maxTokens: 1200
    });

    return finalSummary || 'Unable to generate document summary.';
  } catch (err) {
    console.error('Document summary generation failed:', err);
    throw new Error(`Document summary generation failed: ${err.message}`, { cause: err });
  }
}
