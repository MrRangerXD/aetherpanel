import fs from 'fs';

export interface EnvLine {
  type: 'variable' | 'comment' | 'empty';
  key?: string;
  value?: string;
  quoteChar?: '"' | "'" | null;
  comment?: string; // inline comment or raw comment line
  raw?: string;
}

/**
 * Parses a single line from a .env file into a structured object.
 */
export function parseEnvLine(line: string): EnvLine {
  const trimmed = line.trim();

  if (!trimmed) {
    return { type: 'empty', raw: line };
  }

  if (trimmed.startsWith('#')) {
    return { type: 'comment', comment: line };
  }

  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) {
    // Treat lines without equals sign as comment or raw text
    return { type: 'comment', comment: line };
  }

  const key = line.substring(0, eqIdx).trim();
  const rest = line.substring(eqIdx + 1).trim();

  // Validate environment variable key
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
    return { type: 'comment', comment: line };
  }

  let value = '';
  let quoteChar: '"' | "'" | null = null;
  let comment = '';

  if (rest.startsWith('"')) {
    quoteChar = '"';
    // Find the matching closing double quote
    let closingIdx = -1;
    for (let i = 1; i < rest.length; i++) {
      if (rest[i] === '"' && rest[i - 1] !== '\\') {
        closingIdx = i;
        break;
      }
    }
    if (closingIdx !== -1) {
      value = rest.substring(1, closingIdx);
      const after = rest.substring(closingIdx + 1).trim();
      if (after.startsWith('#')) {
        comment = after;
      }
    } else {
      // Unclosed quote, treat the rest of line as value
      value = rest.substring(1);
    }
  } else if (rest.startsWith("'")) {
    quoteChar = "'";
    // Find the matching closing single quote
    let closingIdx = -1;
    for (let i = 1; i < rest.length; i++) {
      if (rest[i] === "'" && rest[i - 1] !== '\\') {
        closingIdx = i;
        break;
      }
    }
    if (closingIdx !== -1) {
      value = rest.substring(1, closingIdx);
      const after = rest.substring(closingIdx + 1).trim();
      if (after.startsWith('#')) {
        comment = after;
      }
    } else {
      // Unclosed quote, treat the rest of line as value
      value = rest.substring(1);
    }
  } else {
    // Unquoted value. Comments start at the first '#' character.
    const hashIdx = rest.indexOf('#');
    if (hashIdx !== -1) {
      value = rest.substring(0, hashIdx).trim();
      comment = rest.substring(hashIdx).trim();
    } else {
      value = rest;
    }
  }

  // Unescape backslashes if double quoted
  if (quoteChar === '"') {
    value = value.replace(/\\"/g, '"').replace(/\\n/g, '\n').replace(/\\\\/g, '\\');
  } else if (quoteChar === "'") {
    value = value.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
  }

  return {
    type: 'variable',
    key,
    value,
    quoteChar,
    comment: comment || undefined
  };
}

/**
 * Parses a complete .env file content.
 */
export function parseEnvContent(content: string): EnvLine[] {
  // Normalize line endings
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  return lines.map(parseEnvLine);
}

/**
 * Serializes structured EnvLine items back into a standard .env file string.
 */
export function serializeEnvLines(lines: EnvLine[]): string {
  return lines.map((line) => {
    if (line.type === 'empty') {
      return line.raw !== undefined ? line.raw : '';
    }
    if (line.type === 'comment') {
      return line.comment !== undefined ? line.comment : '';
    }

    // Variable line
    const key = line.key || '';
    let val = line.value || '';
    let quote = line.quoteChar;

    // Detect if quoting is necessary due to spaces, quotes, or comment characters inside value
    if (!quote) {
      if (val.includes(' ') || val.includes('#') || val.includes('"') || val.includes("'") || val.includes('\n')) {
        quote = '"';
      }
    }

    if (quote === '"') {
      // Escape value for double quotes
      const escaped = val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      return `${key}="${escaped}"${line.comment ? ' ' + line.comment : ''}`;
    } else if (quote === "'") {
      // Escape value for single quotes
      const escaped = val.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      return `${key}='${escaped}'${line.comment ? ' ' + line.comment : ''}`;
    } else {
      return `${key}=${val}${line.comment ? ' ' + line.comment : ''}`;
    }
  }).join('\n');
}

/**
 * Merges new environment variable key-values into an existing parsed set of lines, preserving formatting.
 */
export function mergeEnvVariables(
  existingLines: EnvLine[],
  newVars: Array<{ key: string; value: string; isEnabled?: boolean }>
): EnvLine[] {
  const result: EnvLine[] = [];
  const processedKeys = new Set<string>();

  // Filter out variables with invalid keys
  const validNewVars = newVars.filter(v => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v.key));

  for (const line of existingLines) {
    if (line.type !== 'variable') {
      result.push(line);
      continue;
    }

    const key = line.key!;
    const match = validNewVars.find(v => v.key === key);

    if (match) {
      // Update value, keep comments and quoting style if possible
      result.push({
        type: 'variable',
        key,
        value: match.value,
        quoteChar: line.quoteChar,
        comment: line.comment
      });
      processedKeys.add(key);
    } else {
      // Key was deleted by user, omit it from the output
    }
  }

  // Append new variables at the end
  for (const v of validNewVars) {
    if (!processedKeys.has(v.key)) {
      result.push({
        type: 'variable',
        key: v.key,
        value: v.value,
        quoteChar: v.value.includes(' ') || v.value.includes('#') ? '"' : null
      });
    }
  }

  return result;
}
