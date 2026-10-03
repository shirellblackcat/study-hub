import type { Flashcard } from './db';

/**
 * SM-2 spaced repetition algorithm (as used by Anki/SuperMemo).
 * quality: 0-5 grade of recall ("Again"=0..1, "Hard"=3, "Good"=4, "Easy"=5)
 * Returns the updated scheduling fields for a flashcard.
 */
export function sm2(
  card: Pick<Flashcard, 'easeFactor' | 'intervalDays' | 'repetitions'>,
  quality: number,
): Pick<Flashcard, 'easeFactor' | 'intervalDays' | 'repetitions' | 'dueAt' | 'lastReviewedAt'> {
  let { easeFactor, intervalDays, repetitions } = card;

  if (quality < 3) {
    // Failed recall: reset repetitions, review again soon
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(intervalDays * easeFactor);
    }
  }

  easeFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  const now = Date.now();
  return {
    easeFactor,
    intervalDays,
    repetitions,
    dueAt: now + intervalDays * 24 * 60 * 60 * 1000,
    lastReviewedAt: now,
  };
}

export function newCardDefaults(): Pick<
  Flashcard,
  'easeFactor' | 'intervalDays' | 'repetitions' | 'dueAt'
> {
  return {
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    dueAt: Date.now(), // due immediately for first review
  };
}
