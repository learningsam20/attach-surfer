import { describe, it, expect } from 'vitest';
import { extractTextFromCSV, extractTextFromTXT } from './attachmentExtractor';

describe('attachmentExtractor', () => {
  describe('extractTextFromCSV', () => {
    it('extracts text from CSV buffer', async () => {
      const csvContent = 'name,age\nJohn,30\nJane,25';
      const buffer = new TextEncoder().encode(csvContent).buffer;

      const result = await extractTextFromCSV(buffer);
      expect(result).toContain('name');
      expect(result).toContain('John');
      expect(result).toContain('Jane');
    });

    it('handles empty CSV', async () => {
      const buffer = new TextEncoder().encode('').buffer;
      const result = await extractTextFromCSV(buffer);
      expect(result).toBe('');
    });
  });

  describe('extractTextFromTXT', () => {
    it('extracts text from TXT buffer', async () => {
      const textContent = 'Hello World\nThis is a test file.';
      const buffer = new TextEncoder().encode(textContent).buffer;

      const result = await extractTextFromTXT(buffer);
      expect(result).toBe(textContent);
    });

    it('handles empty TXT', async () => {
      const buffer = new TextEncoder().encode('').buffer;
      const result = await extractTextFromTXT(buffer);
      expect(result).toBe('');
    });
  });
});
