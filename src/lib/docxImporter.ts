import mammoth from 'mammoth';

export interface ParsedTopic {
  heading: string;
  content: string;
}

export interface ParsedGuide {
  title: string;
  topics: ParsedTopic[];
}

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4']);

/**
 * Converts one top-level body element into one or more readable lines.
 * Lists and tables are "flattened" element-by-element (list item / table row)
 * since their raw textContent would otherwise concatenate every cell/item
 * into a single run-on string with no separators.
 */
function extractLines(node: Element): string[] {
  if (node.tagName === 'UL' || node.tagName === 'OL') {
    return Array.from(node.querySelectorAll('li'))
      .map((li) => li.textContent?.trim() ?? '')
      .filter(Boolean)
      .map((text) => `• ${text}`);
  }

  if (node.tagName === 'TABLE') {
    // Prefix with an invisible marker so extractTermDefinitions() can skip
    // these rows — resource/reference tables aren't term/definition pairs.
    return Array.from(node.querySelectorAll('tr'))
      .map((tr) =>
        Array.from(tr.querySelectorAll('td, th'))
          .map((cell) => cell.textContent?.trim() ?? '')
          .filter(Boolean)
          .join(' — '),
      )
      .filter(Boolean)
      .map((row) => `\u200B${row}`);
  }

  const text = node.textContent?.trim() ?? '';
  return text ? [text] : [];
}

/**
 * Parses a .docx file entirely in the browser (mammoth.js) and splits it into
 * topics based on heading elements. Paragraph/list text under each heading is
 * concatenated as that topic's content. The guide title always comes from the
 * filename — study guide docs rarely use a real H1 "title" heading (the
 * title is often just bold body text), so inferring it from headings is
 * unreliable.
 */
export async function parseDocxFile(file: File): Promise<ParsedGuide> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = Array.from(doc.body.children);

  const topics: ParsedTopic[] = [];
  const title = file.name.replace(/\.docx$/i, '');
  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentHeading && currentLines.length > 0) {
      topics.push({ heading: currentHeading, content: currentLines.join('\n') });
    }
    currentLines = [];
  };

  for (const node of nodes) {
    if (HEADING_TAGS.has(node.tagName)) {
      const text = node.textContent?.trim() ?? '';
      if (!text) continue;
      flush();
      currentHeading = text;
      continue;
    }

    const lines = extractLines(node);
    if (lines.length === 0) continue;

    if (!currentHeading) {
      // Content before any heading: bucket into an "Overview" topic
      currentHeading = 'Overview';
    }
    currentLines.push(...lines);
  }
  flush();

  return { title, topics };
}
