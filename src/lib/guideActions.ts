import { db } from '../db/db';
import { newCardDefaults } from '../db/sm2';
import { extractTermDefinitions, generateQuizQuestions } from './contentGenerator';

/** Deletes a guide and everything derived from it (topics, flashcards, quiz
 * questions/attempts, review logs) in one transaction. */
export async function deleteGuide(guideId: number): Promise<void> {
  await db.transaction(
    'rw',
    [db.guides, db.topics, db.flashcards, db.quizQuestions, db.quizAttempts, db.reviewLogs],
    async () => {
      const flashcardIds = await db.flashcards.where('guideId').equals(guideId).primaryKeys();
      if (flashcardIds.length > 0) {
        await db.reviewLogs.where('flashcardId').anyOf(flashcardIds).delete();
      }
      await db.flashcards.where('guideId').equals(guideId).delete();
      await db.quizQuestions.where('guideId').equals(guideId).delete();
      await db.quizAttempts.where('guideId').equals(guideId).delete();
      await db.topics.where('guideId').equals(guideId).delete();
      await db.guides.delete(guideId);
    },
  );
}

/** Deletes a single flashcard and its review history. */
export async function deleteFlashcard(flashcardId: number): Promise<void> {
  await db.transaction('rw', [db.flashcards, db.reviewLogs], async () => {
    await db.reviewLogs.where('flashcardId').equals(flashcardId).delete();
    await db.flashcards.delete(flashcardId);
  });
}

export interface RegenerateResult {
  flashcardCount: number;
  quizQuestionCount: number;
}

/**
 * Saves edited topic text, then re-derives that topic's flashcards and quiz
 * questions from the new content (replacing whatever was auto-generated
 * before). Scoped to just this topic so editing one section never disturbs
 * other topics' cards or quiz history.
 */
export async function regenerateTopicContent(
  topicId: number,
  guideId: number,
  newContent: string,
): Promise<RegenerateResult> {
  await db.transaction(
    'rw',
    [db.topics, db.flashcards, db.quizQuestions, db.reviewLogs],
    async () => {
      await db.topics.update(topicId, { content: newContent });

      const oldCardIds = await db.flashcards.where('topicId').equals(topicId).primaryKeys();
      if (oldCardIds.length > 0) {
        await db.reviewLogs.where('flashcardId').anyOf(oldCardIds).delete();
      }
      await db.flashcards.where('topicId').equals(topicId).delete();
      await db.quizQuestions.where('topicId').equals(topicId).delete();

      const termDefs = extractTermDefinitions(newContent);
      for (const td of termDefs) {
        await db.flashcards.add({
          guideId,
          topicId,
          front: td.term,
          back: td.definition,
          ...newCardDefaults(),
        });
      }

      const quizQuestions = generateQuizQuestions(termDefs, Math.max(5, termDefs.length));
      for (const q of quizQuestions) {
        await db.quizQuestions.add({
          guideId,
          topicId,
          question: q.question,
          choices: q.choices,
          correctIndex: q.correctIndex,
        });
      }
    },
  );

  const [flashcardCount, quizQuestionCount] = await Promise.all([
    db.flashcards.where('topicId').equals(topicId).count(),
    db.quizQuestions.where('topicId').equals(topicId).count(),
  ]);
  return { flashcardCount, quizQuestionCount };
}
