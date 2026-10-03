import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { deleteGuide, regenerateTopicContent, type RegenerateResult } from '../lib/guideActions';
import { useUnsavedChangesWarning } from '../lib/useUnsavedChangesWarning';

export default function GuideDetail() {
  const { guideId } = useParams();
  const id = Number(guideId);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetTopicId = searchParams.get('topic');
  const scrolledToParam = useRef<string | null>(null);

  const guide = useLiveQuery(() => db.guides.get(id), [id]);
  const topics = useLiveQuery(
    () => db.topics.where('guideId').equals(id).sortBy('order'),
    [id],
    [],
  );

  function scrollToTopic(topicId: number) {
    document.getElementById(`topic-${topicId}`)?.scrollIntoView({ block: 'start' });
  }

  // Client-side routing doesn't trigger the browser's native anchor scroll,
  // so scroll to the linked topic (e.g. from a Search result) once its
  // content has rendered.
  useEffect(() => {
    if (!targetTopicId || !topics || topics.length === 0) return;
    if (scrolledToParam.current === targetTopicId) return;
    scrolledToParam.current = targetTopicId;
    scrollToTopic(Number(targetTopicId));
  }, [targetTopicId, topics]);

  const flashcardCount = useLiveQuery(
    () => db.flashcards.where('guideId').equals(id).count(),
    [id],
    0,
  );
  const dueCount = useLiveQuery(
    () =>
      db.flashcards
        .where('guideId')
        .equals(id)
        .filter((c) => c.dueAt <= Date.now())
        .count(),
    [id],
    0,
  );
  const quizCount = useLiveQuery(
    () => db.quizQuestions.where('guideId').equals(id).count(),
    [id],
    0,
  );
  const quizAttempts = useLiveQuery(
    () =>
      db.quizAttempts
        .where('guideId')
        .equals(id)
        .sortBy('takenAt')
        .then((a) => a.reverse()),
    [id],
    [],
  );

  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (guide !== undefined) setSettled(true);
  }, [guide]);

  if (!guide) {
    if (settled || Number.isNaN(id)) {
      return (
        <div className="mx-auto max-w-xl px-4 pt-10 text-center">
          <p className="text-4xl">🔍</p>
          <p className="mt-3 text-lg font-semibold">Guide not found</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            It may have been deleted, or the link is out of date.
          </p>
          <Link to="/library" className="mt-5 inline-block text-sky-400 underline">
            Back to library
          </Link>
        </div>
      );
    }
    return null;
  }

  async function handleDeleteGuide() {
    if (!window.confirm(`Delete "${guide!.title}"? This removes all its flashcards and quizzes too.`)) {
      return;
    }
    await deleteGuide(id);
    navigate('/library');
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{guide.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{guide.certification}</p>
        </div>
        <button
          onClick={handleDeleteGuide}
          className="shrink-0 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-rose-400"
        >
          Delete guide
        </button>
      </div>

      <Link
        to={`/guide/${id}/manage`}
        className="mt-3 block rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-2 text-center text-sm font-medium text-slate-800 dark:text-slate-200"
      >
        Manage flashcards &amp; quiz questions
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          to={`/study/${id}`}
          className="rounded-xl bg-sky-500 px-4 py-3 text-center font-semibold text-slate-950"
        >
          Flashcards
          <span className="block text-xs font-normal text-slate-900">
            {dueCount} due · {flashcardCount} total
          </span>
        </Link>
        <Link
          to={`/quiz/${id}`}
          className="rounded-xl bg-violet-500 px-4 py-3 text-center font-semibold text-slate-950"
        >
          Quiz
          <span className="block text-xs font-normal text-slate-900">
            {quizCount} question{quizCount === 1 ? '' : 's'}
          </span>
        </Link>
      </div>

      {quizAttempts && quizAttempts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Quiz history
          </h2>
          <ul className="mt-2 space-y-1.5">
            {quizAttempts.slice(0, 10).map((a) => {
              const pct = Math.round((a.correctCount / a.totalQuestions) * 100);
              const barColor = pct >= 80 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
              return (
                <li key={a.id} className="flex items-center gap-3 rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2">
                  <span className="w-20 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {new Date(a.takenAt).toLocaleDateString()}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {pct}%
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Table of Contents
      </h2>
      <nav className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
        <ol className="space-y-1">
          {topics?.map((t, i) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => scrollToTopic(t.id!)}
                className="block w-full truncate rounded px-2 py-1 text-left text-sm text-sky-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:underline"
              >
                {i + 1}. {t.heading}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Topics
      </h2>
      <ul className="mt-2 space-y-3">
        {topics?.map((t) => (
          <TopicItem
            key={t.id}
            topicId={t.id!}
            guideId={id}
            heading={t.heading}
            content={t.content}
            flagged={!!t.flagged}
          />
        ))}
      </ul>
    </div>
  );
}

function TopicItem({
  topicId,
  guideId,
  heading,
  content,
  flagged,
}: {
  topicId: number;
  guideId: number;
  heading: string;
  content: string;
  flagged: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(content);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<RegenerateResult | null>(null);

  useUnsavedChangesWarning(editing && draft !== content);

  async function handleSave() {
    setSaving(true);
    try {
      const r = await regenerateTopicContent(topicId, guideId, draft);
      setResult(r);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function toggleFlag() {
    db.topics.update(topicId, { flagged: !flagged });
  }

  return (
    <li id={`topic-${topicId}`} className="scroll-mt-4 rounded-lg bg-slate-100 dark:bg-slate-800 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium text-sky-400">{heading}</p>
        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={toggleFlag}
            title={flagged ? 'Unflag as hard' : 'Flag as hard to review later'}
            aria-label={flagged ? 'Unflag as hard' : 'Flag as hard to review later'}
            aria-pressed={flagged}
            className={`text-base leading-none ${flagged ? '' : 'opacity-30'}`}
          >
            ⭐
          </button>
          <button
            onClick={() => {
              if (editing && draft !== content && !window.confirm('Discard your unsaved changes to this topic?')) {
                return;
              }
              setDraft(content);
              setEditing((e) => !e);
            }}
            className="text-xs font-medium text-slate-500 underline dark:text-slate-400"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            One line per fact. Saving regenerates this topic's flashcards &amp; quiz questions.
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-2 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40"
          >
            {saving ? 'Regenerating…' : 'Save & regenerate cards'}
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          {content.split('\n').map((line, i) => (
            <p key={i} className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {line.replace(/^\u200B/, '')}
            </p>
          ))}
        </div>
      )}

      {result && !editing && (
        <p className="mt-2 text-xs text-emerald-500">
          ✅ Regenerated: {result.flashcardCount} flashcard{result.flashcardCount === 1 ? '' : 's'},{' '}
          {result.quizQuestionCount} quiz question{result.quizQuestionCount === 1 ? '' : 's'}
        </p>
      )}
    </li>
  );
}
