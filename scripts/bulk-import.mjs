// Bulk-imports all .docx study guides from a folder tree directly on disk,
// replicating the in-app docx-parsing + flashcard/quiz-generation pipeline
// (src/lib/docxImporter.ts, contentGenerator.ts), and writes a single backup
// JSON compatible with the app's "Restore backup" feature (src/lib/backup.ts).
//
// Usage:
//   node scripts/bulk-import.mjs "C:\path\to\TECH FOLDER" [outputFile.json]
import fs from 'node:fs';
import path from 'node:path';
import mammoth from 'mammoth';
import { parseHTML } from 'linkedom';

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4']);
const SEPARATORS = [' - ', ' – ', ' — ', ': ', ' = '];

function walk(dir, exts) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, exts));
    } else if (exts.some((e) => entry.name.toLowerCase().endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

/** Mirrors contentGenerator.ts extractTermDefinitions() */
const TABLE_ROW_MARKER = '\u200B';
function extractTermDefinitions(content) {
  const results = [];
  const lines = content
    .split('\n')
    .filter((l) => !l.startsWith(TABLE_ROW_MARKER))
    .map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(Boolean);

  for (const line of lines) {
    for (const sep of SEPARATORS) {
      const idx = line.indexOf(sep);
      if (idx > 0 && idx < 60) {
        const term = line.slice(0, idx).trim();
        const definition = line.slice(idx + sep.length).trim();
        if (term.length >= 2 && definition.length >= 3 && term.length < 80) {
          results.push({ term, definition });
          break;
        }
      }
    }
  }
  return results;
}

/** Mirrors contentGenerator.ts generateQuizQuestions() */
function generateQuizQuestions(pool, maxQuestions = 10) {
  if (pool.length < 4) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const questions = [];

  for (const item of shuffled) {
    if (questions.length >= maxQuestions) break;
    const distractorPool = pool.filter((p) => p.definition !== item.definition);
    if (distractorPool.length < 3) continue;
    const distractors = [...distractorPool]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map((d) => d.definition);

    const choices = [...distractors, item.definition].sort(() => Math.random() - 0.5);
    questions.push({
      question: `What best describes "${item.term}"?`,
      choices,
      correctIndex: choices.indexOf(item.definition),
      term: item.term,
    });
  }
  return questions;
}

/** Mirrors docxImporter.ts extractLines(): flattens list items / table rows into separate lines. */
function extractLines(node) {
  if (node.tagName === 'UL' || node.tagName === 'OL') {
    return Array.from(node.querySelectorAll('li'))
      .map((li) => (li.textContent ?? '').trim())
      .filter(Boolean)
      .map((text) => `• ${text}`);
  }

  if (node.tagName === 'TABLE') {
    return Array.from(node.querySelectorAll('tr'))
      .map((tr) =>
        Array.from(tr.querySelectorAll('td, th'))
          .map((cell) => (cell.textContent ?? '').trim())
          .filter(Boolean)
          .join(' — '),
      )
      .filter(Boolean)
      .map((row) => `\u200B${row}`);
  }

  const text = (node.textContent ?? '').trim();
  return text ? [text] : [];
}

/** Mirrors docxImporter.ts parseDocxFile(), operating on an HTML string instead of a File. */
function splitIntoTopics(html, fallbackTitle) {
  const { document } = parseHTML(
    `<!DOCTYPE html><html><head></head><body>${html}</body></html>`,
  );
  const nodes = Array.from(document.body.children);

  const topics = [];
  const title = fallbackTitle;
  let currentHeading = null;
  let currentLines = [];

  const flush = () => {
    if (currentHeading && currentLines.length > 0) {
      topics.push({ heading: currentHeading, content: currentLines.join('\n') });
    }
    currentLines = [];
  };

  for (const node of nodes) {
    if (HEADING_TAGS.has(node.tagName)) {
      const text = (node.textContent ?? '').trim();
      if (!text) continue;
      flush();
      currentHeading = text;
      continue;
    }

    const lines = extractLines(node);
    if (lines.length === 0) continue;

    if (!currentHeading) {
      currentHeading = 'Overview';
    }
    currentLines.push(...lines);
  }
  flush();

  return { title, topics };
}

function certFromPath(rootDir, filePath) {
  const rel = path.relative(rootDir, filePath);
  const parts = rel.split(path.sep);
  return parts.length >= 2 ? parts[0] : 'Uncategorized';
}

async function main() {
  const rootDir = process.argv[2];
  const outFile = process.argv[3] ?? 'study-hub-backup.json';

  if (!rootDir || !fs.existsSync(rootDir)) {
    console.error('Usage: node scripts/bulk-import.mjs "<folder path>" [outputFile.json]');
    process.exit(1);
  }

  const docxFiles = walk(rootDir, ['.docx']);
  console.log(`Found ${docxFiles.length} .docx files under ${rootDir}`);

  const guides = [];
  const topics = [];
  const flashcards = [];
  const quizQuestions = [];

  let guideId = 1;
  let topicId = 1;
  let flashcardId = 1;
  let quizQuestionId = 1;
  let failures = 0;

  for (const filePath of docxFiles) {
    const fileName = path.basename(filePath);
    const certification = certFromPath(rootDir, filePath);
    try {
      const buffer = fs.readFileSync(filePath);
      const { value: html } = await mammoth.convertToHtml({ buffer });
      const fallbackTitle = fileName.replace(/\.docx$/i, '');
      const parsed = splitIntoTopics(html, fallbackTitle);

      const thisGuideId = guideId++;
      guides.push({
        id: thisGuideId,
        title: parsed.title,
        certification,
        createdAt: Date.now(),
        sourceFileName: fileName,
      });

      const allTermDefs = [];
      let topicCount = 0;

      parsed.topics.forEach((topic, order) => {
        const thisTopicId = topicId++;
        topics.push({
          id: thisTopicId,
          guideId: thisGuideId,
          heading: topic.heading,
          order,
          content: topic.content,
        });
        topicCount++;

        const termDefs = extractTermDefinitions(topic.content);
        for (const td of termDefs) {
          allTermDefs.push({ topicId: thisTopicId, ...td });
          flashcards.push({
            id: flashcardId++,
            guideId: thisGuideId,
            topicId: thisTopicId,
            front: td.term,
            back: td.definition,
            easeFactor: 2.5,
            intervalDays: 0,
            repetitions: 0,
            dueAt: Date.now(),
          });
        }
      });

      const quizzes = generateQuizQuestions(allTermDefs, Math.max(10, allTermDefs.length));
      for (const q of quizzes) {
        const owner = allTermDefs.find((t) => t.term === q.term);
        quizQuestions.push({
          id: quizQuestionId++,
          guideId: thisGuideId,
          topicId: owner?.topicId ?? allTermDefs[0]?.topicId,
          question: q.question,
          choices: q.choices,
          correctIndex: q.correctIndex,
        });
      }

      console.log(
        `✅ [${certification}] ${fileName}: ${topicCount} topics, ${allTermDefs.length} flashcards, ${quizzes.length} quiz questions`,
      );
    } catch (err) {
      failures++;
      console.error(`❌ [${certification}] ${fileName}: ${err.message}`);
    }
  }

  const backup = {
    version: 1,
    exportedAt: Date.now(),
    guides,
    topics,
    flashcards,
    quizQuestions,
    quizAttempts: [],
    reviewLogs: [],
  };

  fs.writeFileSync(outFile, JSON.stringify(backup));
  console.log(
    `\nWrote ${outFile}: ${guides.length} guides, ${topics.length} topics, ${flashcards.length} flashcards, ${quizQuestions.length} quiz questions (${failures} failures)`,
  );
}

main();
