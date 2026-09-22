import { getWebLLMEngine } from '../utils/webllmEngine';

export async function generateSummary(results, contents, onProgress) {
  if (!results || results.length === 0) {
    return 'No search results to summarize.';
  }

  const sections = results.map((r, i) => {
    const content = contents.find(c => c.url === r.url);
    const markdown = content?.success ? content.markdown : r.snippet || '';
    return `## Result ${i + 1}: ${r.title}\n**Source:** ${r.url}\n**Engine:** ${r.engine}\n\n${markdown}`;
  }).join('\n\n---\n\n');

  const prompt = `Based on the following search results, provide a comprehensive summary. Combine the key information from all sources, highlight the most important points, and present a cohesive overview. If there are conflicting pieces of information, note them.\n\n${sections}\n\n---\n\nProvide a well-structured summary with clear sections and bullet points where appropriate.`;

  onProgress?.('Generating summary with AI...');

  try {
    const engine = await getWebLLMEngine((progress) => {
      onProgress?.(progress);
    });

    const response = await engine.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful research assistant. Analyze search results and provide clear, accurate summaries. Use markdown formatting with headers, bullet points, and emphasis where appropriate. Be concise but thorough.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    return response.choices[0]?.message?.content || 'Unable to generate summary.';
  } catch (err) {
    console.error('Summary generation failed:', err);
    throw new Error(`Summary generation failed: ${err.message}`);
  }
}
