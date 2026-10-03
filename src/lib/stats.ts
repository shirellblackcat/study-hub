import { db } from '../db/db';

export interface StreakInfo {
  current: number;
  longest: number;
}

/** Computes the current consecutive-day study streak (ending today) and the
 * longest streak ever achieved, based on days with at least one review log. */
export async function computeStreak(): Promise<StreakInfo> {
  const logs = await db.reviewLogs.orderBy('reviewedAt').toArray();
  if (logs.length === 0) return { current: 0, longest: 0 };

  const days = new Set(logs.map((l) => new Date(l.reviewedAt).toISOString().slice(0, 10)));
  const sortedDays = [...days].sort();

  // Longest streak: scan sorted unique days for the longest consecutive run.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]);
    const curr = new Date(sortedDays[i]);
    const dayDiff = Math.round((curr.getTime() - prev.getTime()) / 86400000);
    run = dayDiff === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  // Current streak: count consecutive days ending today (today itself is
  // optional — a day not yet studied doesn't break an in-progress streak).
  let current = 0;
  const cursor = new Date();
  for (;;) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      current++;
      cursor.setDate(cursor.getDate() - 1);
    } else if (current === 0 && key === new Date().toISOString().slice(0, 10)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    } else {
      break;
    }
  }
  return { current, longest: Math.max(longest, current) };
}

export interface GuideMastery {
  guideId: number;
  title: string;
  certification: string;
  totalCards: number;
  matureCards: number; // repetitions >= 2 (roughly "known")
  dueCount: number;
}

export async function computeGuideMastery(): Promise<GuideMastery[]> {
  const [guides, allCards] = await Promise.all([db.guides.toArray(), db.flashcards.toArray()]);
  const now = Date.now();

  // Group once in memory instead of issuing one indexed query per guide —
  // with hundreds of guides and tens of thousands of cards, a single full
  // table scan + grouping is far faster than N sequential IndexedDB queries.
  const cardsByGuide = new Map<number, typeof allCards>();
  for (const card of allCards) {
    const list = cardsByGuide.get(card.guideId);
    if (list) list.push(card);
    else cardsByGuide.set(card.guideId, [card]);
  }

  return guides.map((guide) => {
    const cards = cardsByGuide.get(guide.id!) ?? [];
    return {
      guideId: guide.id!,
      title: guide.title,
      certification: guide.certification,
      totalCards: cards.length,
      matureCards: cards.filter((c) => c.repetitions >= 2).length,
      dueCount: cards.filter((c) => c.dueAt <= now).length,
    };
  });
}
