import { db } from '../db/db';
import { computeGuideMastery, computeStreak } from './stats';

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(filename: string, rows: string[][]): void {
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Exports a human-readable CSV summary of mastery and quiz performance —
 * useful for reviewing progress outside the app, separate from the full
 * JSON data backup. */
export async function exportProgressReport(): Promise<void> {
  const [mastery, streak, attempts, guides] = await Promise.all([
    computeGuideMastery(),
    computeStreak(),
    db.quizAttempts.orderBy('takenAt').reverse().toArray(),
    db.guides.toArray(),
  ]);
  const titleById = new Map(guides.map((g) => [g.id!, g.title]));

  const rows: string[][] = [
    ['Study Hub Progress Report', new Date().toLocaleString()],
    [],
    ['Current streak (days)', String(streak.current)],
    ['Longest streak (days)', String(streak.longest)],
    [],
    ['Guide', 'Certification', 'Total Cards', 'Mastered Cards', 'Mastery %', 'Due Now'],
    ...mastery.map((m) => [
      m.title,
      m.certification,
      String(m.totalCards),
      String(m.matureCards),
      m.totalCards === 0 ? '—' : `${Math.round((m.matureCards / m.totalCards) * 100)}%`,
      String(m.dueCount),
    ]),
    [],
    ['Quiz History', 'Date', 'Score', 'Percent'],
    ...attempts.map((a) => [
      titleById.get(a.guideId) ?? 'Unknown guide',
      new Date(a.takenAt).toLocaleDateString(),
      `${a.correctCount}/${a.totalQuestions}`,
      `${Math.round((a.correctCount / a.totalQuestions) * 100)}%`,
    ]),
  ];

  downloadCsv(`study-hub-progress-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}
