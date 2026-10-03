/**
 * Heuristics for turning raw study-guide text into flashcards and quiz
 * questions. These look for "term/definition" style lines, which are common
 * in IT certification study guides (e.g. "TCP: connection-oriented protocol",
 * "RAID 5 - striping with parity", "DNS = Domain Name System").
 */

export interface TermDefinition {
  term: string;
  definition: string;
}

const SEPARATORS = [' - ', ' – ', ' — ', ': ', ' = '];
// Table rows are tagged with this invisible marker (see docxImporter.ts) so they
// render normally but are excluded from term/definition extraction — resource
// tables (e.g. "Category — Resource — Notes") aren't genuine term/def pairs and
// produce noisy, duplicate-front flashcards if treated as such.
const TABLE_ROW_MARKER = '\u200B';

export function extractTermDefinitions(content: string): TermDefinition[] {
  const results: TermDefinition[] = [];
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

export interface GeneratedQuizQuestion {
  question: string;
  choices: string[];
  correctIndex: number;
}

/**
 * Builds multiple-choice questions from a pool of term/definitions, using
 * other definitions in the pool as plausible-but-wrong distractors.
 */
export function generateQuizQuestions(
  pool: TermDefinition[],
  maxQuestions = 10,
): GeneratedQuizQuestion[] {
  if (pool.length < 4) return [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const questions: GeneratedQuizQuestion[] = [];

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
    });
  }
  return questions;
}
