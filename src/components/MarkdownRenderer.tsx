import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];

  const parseInline = (text: string): React.ReactNode => {
    // Process bold (**text**), code (`code`), and links ([text](url))
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIndex = 0;

    while (remaining.length > 0) {
      // Bold match: **text**
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      // Inline code match: `code`
      const codeMatch = remaining.match(/`([^`]+)`/);
      // Link match: [title](url)
      const linkMatch = remaining.match(/\[(.*?)\]\((.*?)\)/);

      let earliestIdx = remaining.length;
      let matchType: 'bold' | 'code' | 'link' | null = null;
      let matchedText = '';
      let matchPayload1 = '';
      let matchPayload2 = '';

      if (boldMatch && boldMatch.index !== undefined && boldMatch.index < earliestIdx) {
        earliestIdx = boldMatch.index;
        matchType = 'bold';
        matchedText = boldMatch[0];
        matchPayload1 = boldMatch[1];
      }
      if (codeMatch && codeMatch.index !== undefined && codeMatch.index < earliestIdx) {
        earliestIdx = codeMatch.index;
        matchType = 'code';
        matchedText = codeMatch[0];
        matchPayload1 = codeMatch[1];
      }
      if (linkMatch && linkMatch.index !== undefined && linkMatch.index < earliestIdx) {
        earliestIdx = linkMatch.index;
        matchType = 'link';
        matchedText = linkMatch[0];
        matchPayload1 = linkMatch[1];
        matchPayload2 = linkMatch[2];
      }

      if (!matchType) {
        parts.push(remaining);
        break;
      }

      // Push text before match
      if (earliestIdx > 0) {
        parts.push(remaining.substring(0, earliestIdx));
      }

      if (matchType === 'bold') {
        parts.push(<strong key={`b-${keyIndex++}`} className="font-semibold text-white">{matchPayload1}</strong>);
      } else if (matchType === 'code') {
        parts.push(
          <code key={`c-${keyIndex++}`} className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/60 text-amber-400 font-mono text-[13px]">
            {matchPayload1}
          </code>
        );
      } else if (matchType === 'link') {
        parts.push(
          <a
            key={`a-${keyIndex++}`}
            href={matchPayload2}
            target="_blank"
            rel="noreferrer"
            className="text-amber-400 hover:text-amber-300 underline decoration-amber-500/40 hover:decoration-amber-400 font-medium"
          >
            {matchPayload1}
          </a>
        );
      }

      remaining = remaining.substring(earliestIdx + matchedText.length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`cb-${i}`} className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 overflow-x-auto text-xs text-zinc-300 font-mono my-3">
            <code>{codeBlockContent.join('\n')}</code>
          </pre>
        );
        codeBlockContent = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Dividers
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={`hr-${i}`} className="border-zinc-800 my-6" />);
      continue;
    }

    // Headings
    if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-6 mb-4">
          {parseInline(line.substring(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-lg sm:text-xl font-bold text-white tracking-tight mt-6 mb-3 flex items-center gap-2 border-b border-zinc-800/80 pb-2">
          {parseInline(line.substring(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-base font-semibold text-zinc-200 mt-4 mb-2">
          {parseInline(line.substring(4))}
        </h3>
      );
      continue;
    }

    // Unordered lists
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      const listText = line.trim().substring(2);
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2.5 my-1.5 pl-2 text-zinc-300 text-sm leading-relaxed">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 mt-2 shrink-0" />
          <div>{parseInline(listText)}</div>
        </div>
      );
      continue;
    }

    // Ordered lists
    const orderedMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      elements.push(
        <div key={`oli-${i}`} className="flex items-start gap-2.5 my-1.5 pl-2 text-zinc-300 text-sm leading-relaxed">
          <span className="font-mono text-xs font-bold text-amber-400 mt-0.5 shrink-0 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
            {orderedMatch[1]}
          </span>
          <div>{parseInline(orderedMatch[2])}</div>
        </div>
      );
      continue;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={`sp-${i}`} className="h-3" />);
      continue;
    }

    // Standard paragraphs
    elements.push(
      <p key={`p-${i}`} className="text-sm text-zinc-300 leading-relaxed my-2">
        {parseInline(line)}
      </p>
    );
  }

  return (
    <div className={`prose prose-invert max-w-none ${className}`}>
      {elements}
    </div>
  );
};
