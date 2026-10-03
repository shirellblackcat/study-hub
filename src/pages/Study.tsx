import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, type Flashcard } from '../db/db';
import { sm2 } from '../db/sm2';

const GRADES: { label: string; quality: number; className: string }[] = [
  { label: 'Again', quality: 1, className: 'bg-rose-600' },
  { label: 'Hard', quality: 3, className: 'bg-amber-600' },
  { label: 'Good', quality: 4, className: 'bg-sky-600' },
  { label: 'Easy', quality: 5, className: 'bg-emerald-600' },
];

const MAX_SESSION_SIZE = 30;

export default function Study() {
  const { guideId } = useParams();
  const isAll = guideId === 'all';
  const isFlagged = guideId === 'flagged';
  const id = isAll || isFlagged ? null : Number(guideId);

  const [queue, setQueue] = useState<Flashcard[]>([]);
  const [guideTitles, setGuideTitles] = useState<Map<number, string>>(new Map());
  const [totalDue, setTotalDue] = useState(0);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionDone, setSessionDone] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    if (isFlagged) {
      db.topics
        .filter((t) => !!t.flagged)
        .toArray()
        .then(async (flaggedTopics) => {
          const topicIds = flaggedTopics.map((t) => t.id!);
          const cards = topicIds.length
            ? await db.flashcards.where('topicId').anyOf(topicIds).toArray()
            : [];
          setTotalDue(cards.length);
          const shuffled = [...cards].sort(() => Math.random() - 0.5).slice(0, MAX_SESSION_SIZE);
          const guideIds = [...new Set(shuffled.map((c) => c.guideId))];
          const guides = await db.guides.bulkGet(guideIds);
          setGuideTitles(
            new Map(guides.filter(Boolean).map((g) => [g!.id!, g!.title])),
          );
          setQueue(shuffled);
          setLoading(false);
        });
    } else if (isAll) {
      db.flashcards
        .where('dueAt')
        .belowOrEqual(Date.now())
        .toArray()
        .then(async (cards) => {
          setTotalDue(cards.length);
          const shuffled = [...cards].sort(() => Math.random() - 0.5).slice(0, MAX_SESSION_SIZE);
          const guideIds = [...new Set(shuffled.map((c) => c.guideId))];
          const guides = await db.guides.bulkGet(guideIds);
          setGuideTitles(
            new Map(guides.filter(Boolean).map((g) => [g!.id!, g!.title])),
          );
          setQueue(shuffled);
          setLoading(false);
        });
    } else {
      db.flashcards
        .where('guideId')
        .equals(id as number)
        .filter((c) => c.dueAt <= Date.now())
        .toArray()
        .then((cards) => {
          setTotalDue(cards.length);
          setQueue(cards);
          setLoading(false);
        });
    }
  }, [id, isAll]);

  async function grade(quality: number) {
    const card = queue[index];
    if (!card?.id) return;
    const updates = sm2(card, quality);
    await db.flashcards.update(card.id, updates);
    await db.reviewLogs.add({ flashcardId: card.id, reviewedAt: Date.now(), quality });

    setSessionDone((d) => d + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  // Keyboard shortcuts: Space/Enter reveals the answer, 1-4 grade it
  // (Again/Hard/Good/Easy) once revealed.
  useEffect(() => {
    if (loading || index >= queue.length) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setRevealed((r) => !r);
      } else if (revealed && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        grade(GRADES[Number(e.key) - 1].quality);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, index, queue.length, revealed]);

  if (loading) return null;

  const backLink = isAll || isFlagged ? '/' : `/guide/${id}`;
  const backLabel = isAll || isFlagged ? 'Back to dashboard' : 'Back to guide';

  if (queue.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 text-center">
        <p className="text-4xl">🎉</p>
        <p className="mt-3 text-lg font-semibold">All caught up!</p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          {isFlagged
            ? 'No flagged topics have cards to review. Flag a hard topic from its guide page.'
            : isAll
              ? 'No cards due across any guide right now.'
              : 'No cards due for this guide right now.'}
        </p>
        <Link to={backLink} className="mt-5 inline-block text-sky-400 underline">
          {backLabel}
        </Link>
      </div>
    );
  }

  if (index >= queue.length) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 text-center">
        <p className="text-4xl">✅</p>
        <p className="mt-3 text-lg font-semibold">Session complete</p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">You reviewed {sessionDone} cards.</p>
        {(isAll || isFlagged) && totalDue > queue.length && (
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
            {totalDue - queue.length} more due — start another session to keep going.
          </p>
        )}
        <Link to={backLink} className="mt-5 inline-block text-sky-400 underline">
          {backLabel}
        </Link>
      </div>
    );
  }

  const card = queue[index];
  const guideTitle = isAll || isFlagged ? guideTitles.get(card.guideId) : null;

  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          Card {index + 1} of {queue.length}
        </span>
        <Link to={backLink} className="underline">
          Exit
        </Link>
      </div>
      {(isAll || isFlagged) && guideTitle && (
        <p className="mt-1 truncate text-xs font-medium text-sky-400">{guideTitle}</p>
      )}

      <button
        onClick={() => setRevealed((r) => !r)}
        className="mt-4 flex min-h-[40vh] w-full flex-col items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 p-6 text-center"
      >
        <p className="text-lg font-semibold">{card.front}</p>
        {revealed && (
          <p className="mt-4 border-t border-slate-300 dark:border-slate-700 pt-4 text-slate-600 dark:text-slate-300">{card.back}</p>
        )}
        {!revealed && (
          <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">Tap or press Space to reveal answer</p>
        )}
      </button>

      {revealed && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {GRADES.map((g, i) => (
            <button
              key={g.label}
              onClick={() => grade(g.quality)}
              className={`rounded-lg py-3 text-sm font-semibold text-white ${g.className}`}
            >
              {g.label}
              <span className="block text-xs font-normal opacity-75">{i + 1}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
