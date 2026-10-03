import { db } from '../db/db';

const BACKUP_VERSION = 1;

interface BackupFile {
  version: number;
  exportedAt: number;
  guides: unknown[];
  topics: unknown[];
  flashcards: unknown[];
  quizQuestions: unknown[];
  quizAttempts: unknown[];
  reviewLogs: unknown[];
}

/** Serializes the entire local database to a downloadable JSON backup file. */
export async function exportBackup(): Promise<void> {
  const [guides, topics, flashcards, quizQuestions, quizAttempts, reviewLogs] = await Promise.all([
    db.guides.toArray(),
    db.topics.toArray(),
    db.flashcards.toArray(),
    db.quizQuestions.toArray(),
    db.quizAttempts.toArray(),
    db.reviewLogs.toArray(),
  ]);

  const backup: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    guides,
    topics,
    flashcards,
    quizQuestions,
    quizAttempts,
    reviewLogs,
  };

  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `study-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Restores a backup file, merging it into whatever is already in this
 * browser's database (existing data is preserved; ids are remapped so
 * nothing collides or gets overwritten).
 */
export async function importBackup(file: File): Promise<void> {
  const text = await file.text();
  const backup = JSON.parse(text) as BackupFile;

  await db.transaction(
    'rw',
    [db.guides, db.topics, db.flashcards, db.quizQuestions, db.quizAttempts, db.reviewLogs],
    async () => {
      const guideIdMap = new Map<number, number>();
      const topicIdMap = new Map<number, number>();

      for (const g of backup.guides as Array<Record<string, unknown>>) {
        const { id: oldId, ...rest } = g;
        const newId = await db.guides.add(rest as never);
        guideIdMap.set(oldId as number, newId);
      }

      for (const t of backup.topics as Array<Record<string, unknown>>) {
        const { id: oldId, guideId, ...rest } = t;
        const newGuideId = guideIdMap.get(guideId as number);
        if (newGuideId === undefined) continue;
        const newId = await db.topics.add({ ...rest, guideId: newGuideId } as never);
        topicIdMap.set(oldId as number, newId);
      }

      for (const f of backup.flashcards as Array<Record<string, unknown>>) {
        const { id: _oldId, guideId, topicId, ...rest } = f;
        const newGuideId = guideIdMap.get(guideId as number);
        const newTopicId = topicIdMap.get(topicId as number);
        if (newGuideId === undefined || newTopicId === undefined) continue;
        await db.flashcards.add({ ...rest, guideId: newGuideId, topicId: newTopicId } as never);
      }

      for (const q of backup.quizQuestions as Array<Record<string, unknown>>) {
        const { id: _oldId, guideId, topicId, ...rest } = q;
        const newGuideId = guideIdMap.get(guideId as number);
        const newTopicId = topicIdMap.get(topicId as number);
        if (newGuideId === undefined || newTopicId === undefined) continue;
        await db.quizQuestions.add({ ...rest, guideId: newGuideId, topicId: newTopicId } as never);
      }

      for (const a of backup.quizAttempts as Array<Record<string, unknown>>) {
        const { id: _oldId, guideId, ...rest } = a;
        const newGuideId = guideIdMap.get(guideId as number);
        if (newGuideId === undefined) continue;
        await db.quizAttempts.add({ ...rest, guideId: newGuideId } as never);
      }
      // reviewLogs reference flashcard ids which are not stably remapped here;
      // review history is intentionally not merged across devices to avoid
      // corrupting spaced-repetition state tied to the new flashcard ids.
    },
  );
}
