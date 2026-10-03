import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import { computeGuideMastery, computeStreak, type GuideMastery } from '../lib/stats';

export default function Dashboard() {
  const guideCount = useLiveQuery(() => db.guides.count(), [], 0);
  const dueCount = useLiveQuery(
    () => db.flashcards.where('dueAt').belowOrEqual(Date.now()).count(),
    [],
    0,
  );
  const quizCount = useLiveQuery(() => db.quizQuestions.count(), [], 0);
  const flaggedCount = useLiveQuery(
    () => db.topics.filter((t) => !!t.flagged).count(),
    [],
    0,
  );
  const [streak, setStreak] = useState({ current: 0, longest: 0 });
  const [mastery, setMastery] = useState<GuideMastery[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    computeStreak().then(setStreak);
    computeGuideMastery().then(setMastery);
  }, [guideCount, dueCount]);

  const q = query.trim().toLowerCase();
  const visibleMastery = mastery.filter(
    (m) => !q || m.title.toLowerCase().includes(q) || m.certification.toLowerCase().includes(q),
  );

  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <h1 className="text-2xl font-bold">Study Hub</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Your IT certification learning dashboard</p>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <StatCard label="Guides" value={guideCount} />
        <StatCard label="Due today" value={dueCount} accent={dueCount > 0} />
        <StatCard label="Streak" value={streak.current} suffix="🔥" sub={`best ${streak.longest}`} />
      </div>

      {guideCount === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
          <p className="text-slate-600 dark:text-slate-300">No study guides yet.</p>
          <Link
            to="/import"
            className="mt-3 inline-block rounded-lg bg-sky-500 px-4 py-2 font-medium text-slate-950"
          >
            Import your first guide
          </Link>
        </div>
      ) : (
        <>
          {dueCount > 0 && (
            <Link
              to="/study/all"
              className="mt-6 block rounded-xl bg-sky-500 px-4 py-3 text-center font-semibold text-slate-950"
            >
              Review {dueCount} due card{dueCount === 1 ? '' : 's'} →
            </Link>
          )}

          {quizCount > 0 && (
            <Link
              to="/quiz/all"
              className="mt-3 block rounded-xl bg-violet-500 px-4 py-3 text-center font-semibold text-slate-950"
            >
              Quiz me across all guides →
            </Link>
          )}

          {flaggedCount > 0 && (
            <Link
              to="/study/flagged"
              className="mt-3 block rounded-xl bg-amber-500 px-4 py-3 text-center font-semibold text-slate-950"
            >
              ⭐ Review {flaggedCount} flagged topic{flaggedCount === 1 ? '' : 's'} →
            </Link>
          )}

          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Your guides
          </h2>
          {mastery.length > 5 && (
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by title or certification…"
              className="mt-2 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
          )}
          {q && visibleMastery.length === 0 && (
            <p className="mt-3 text-slate-500 dark:text-slate-400">No guides match "{query}".</p>
          )}
          <ul className="mt-3 space-y-2">
            {visibleMastery.map((m) => (
              <li key={m.guideId}>
                <Link
                  to={`/guide/${m.guideId}`}
                  className="flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{m.certification}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-semibold text-sky-400">
                      {m.totalCards === 0
                        ? '—'
                        : `${Math.round((m.matureCards / m.totalCards) * 100)}%`}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">mastered</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  suffix,
  sub,
}: {
  label: string;
  value: number;
  accent?: boolean;
  suffix?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3 text-center">
      <p className={`text-2xl font-bold ${accent ? 'text-amber-400' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}
        {suffix ? <span className="ml-1 text-base">{suffix}</span> : null}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      {sub && <p className="text-[10px] text-slate-400 dark:text-slate-500">{sub}</p>}
    </div>
  );
}
