// eval/harness/context-builder.mjs
// trace:implements SPEC-EVAL-002 GAP-002
//! Structured Context Builder with Symbol Extraction and Budget Controls

import path from 'path';
import fs from 'fs';

/**
 * Builds a structured context pack for the target task and files
 * @param {object} params
 * @param {string[]} params.targetFiles
 * @param {string} [params.goal]
 * @param {string} [params.repoRoot]
 * @param {number} [params.maxChars]
 * @returns {{ contextSummary: string, files: object[], relatedTypes: string[] }}
 */
export function buildTaskContext({ targetFiles, goal, repoRoot = process.cwd(), maxChars = 14000 }) {
  const files = [];
  const relatedTypes = [];
  let currentChars = 0;

  for (const relPath of targetFiles) {
    const fullPath = path.resolve(repoRoot, relPath);
    if (!fs.existsSync(fullPath)) continue;

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    
    // Extract key symbols (functions, structs, exports, classes)
    const symbols = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(pub\s+(fn|struct|enum|trait)|export\s+(function|class|const|async\s+function)|async\s+function|function\s+[a-zA-Z0-9_]+)/.test(line)) {
        symbols.push({ line: i + 1, signature: line.trim() });
      }
    }

    // Smart slice if file is very large: preserve top header + symbol signatures + relevant code
    let includedContent = content;
    if (content.length > maxChars) {
      // Keep first 200 lines and last 100 lines + symbol outline
      const topChunk = lines.slice(0, 200).join('\n');
      const bottomChunk = lines.slice(-80).join('\n');
      includedContent = `${topChunk}\n\n// ... [STRUCTURED CONTEXT SUMMARY: ${lines.length - 280} lines omitted for token budget] ...\n\n${bottomChunk}`;
    }

    files.push({
      path: relPath,
      totalLines: lines.length,
      symbols,
      content: includedContent
    });

    currentChars += includedContent.length;
  }

  // Check for related types definition in Rust or TS
  const typesPath = path.resolve(repoRoot, 'src-tauri/src/models/types.rs');
  if (fs.existsSync(typesPath) && targetFiles.some(f => f.includes('src-tauri'))) {
    const typesContent = fs.readFileSync(typesPath, 'utf8');
    const typeNames = [...typesContent.matchAll(/pub\s+struct\s+([A-Za-z0-9_]+)/g)].map(m => m[1]);
    relatedTypes.push(...typeNames.slice(0, 15));
  }

  return {
    contextSummary: `Extracted ${files.length} target files with ${files.reduce((acc, f) => acc + f.symbols.length, 0)} symbols.`,
    files,
    relatedTypes
  };
}
