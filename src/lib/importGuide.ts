import { db } from '../db/db';
import { newCardDefaults } from '../db/sm2';
import { parseDocxFile } from './docxImporter';
import { extractTermDefinitions, generateQuizQuestions } from './contentGenerator';

export interface ImportResult {
  guideId: number;
  topicCount: number;
  flashcardCount: number;
  quizQuestionCount: number;
}

/**
 * Full pipeline: parse a .docx file, store the guide + topics, then
 * auto-generate flashcards and quiz questions from term/definition patterns.
 */
export async function importDocxGuide(file: File, certification: string): Promise<ImportResult> {
  const parsed = await parseDocxFile(file);

  const guideId = await db.guides.add({
    title: parsed.title,
    certification,
    createdAt: Date.now(),
    sourceFileName: file.name,
  });

  let flashcardCount = 0;
  let quizQuestionCount = 0;

  // Collect all term/definitions guide-wide so quiz distractors can draw
  // from other topics too (more realistic wrong answers).
  const allTermDefs: { topicId: number; term: string; definition: string }[] = [];

  for (let i = 0; i < parsed.topics.length; i++) {
    const topic = parsed.topics[i];
    const topicId = await db.topics.add({
      guideId,
      heading: topic.heading,
      order: i,
      content: topic.content,
    });

    const termDefs = extractTermDefinitions(topic.content);
    for (const td of termDefs) {
      allTermDefs.push({ topicId, ...td });
      await db.flashcards.add({
        guideId,
        topicId,
        front: td.term,
        back: td.definition,
        ...newCardDefaults(),
      });
      flashcardCount++;
    }
  }

  const quizQuestions = generateQuizQuestions(allTermDefs, Math.max(10, allTermDefs.length));
  for (const q of quizQuestions) {
    // topicId: find the topic that owns this question's term, fallback to first topic
    const owner = allTermDefs.find((t) => q.question.includes(t.term));
    await db.quizQuestions.add({
      guideId,
      topicId: owner?.topicId ?? allTermDefs[0]?.topicId ?? 0,
      question: q.question,
      choices: q.choices,
      correctIndex: q.correctIndex,
    });
    quizQuestionCount++;
  }

  return {
    guideId,
    topicCount: parsed.topics.length,
    flashcardCount,
    quizQuestionCount,
  };
}
