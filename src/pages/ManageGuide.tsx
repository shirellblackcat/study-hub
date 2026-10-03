import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link, useParams } from 'react-router-dom';
import { db, type Flashcard, type QuizQuestion } from '../db/db';
import { deleteFlashcard } from '../lib/guideActions';
import { useUnsavedChangesWarning } from '../lib/useUnsavedChangesWarning';

type Tab = 'flashcards' | 'quiz';

export default function ManageGuide() {
  const { guideId } = useParams();
  const id = Number(guideId);
  const [tab, setTab] = useState<Tab>('flashcards');

  const guide = useLiveQuery(() => db.guides.get(id), [id]);
  const flashcards = useLiveQuery(
    () => db.flashcards.where('guideId').equals(id).toArray(),
    [id],
    [],
  );
  const quizQuestions = useLiveQuery(
    () => db.quizQuestions.where('guideId').equals(id).toArray(),
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
          <Link to="/library" className="mt-5 inline-block text-sky-400 underline">
            Back to library
          </Link>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Manage content</h1>
        <Link to={`/guide/${id}`} className="text-sm text-sky-400 underline">
          Back to guide
        </Link>
      </div>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{guide.title}</p>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab('flashcards')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            tab === 'flashcards' ? 'bg-sky-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Flashcards ({flashcards?.length ?? 0})
        </button>
        <button
          onClick={() => setTab('quiz')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium ${
            tab === 'quiz' ? 'bg-violet-500 text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          Quiz questions ({quizQuestions?.length ?? 0})
        </button>
      </div>

      {tab === 'flashcards' ? (
        <ul className="mt-4 space-y-3">
          {flashcards?.map((c) => (
            <FlashcardRow key={c.id} card={c} />
          ))}
          {flashcards?.length === 0 && (
            <p className="mt-6 text-center text-slate-500 dark:text-slate-400">No flashcards for this guide.</p>
          )}
        </ul>
      ) : (
        <ul className="mt-4 space-y-3">
          {quizQuestions?.map((q) => (
            <QuizQuestionRow key={q.id} question={q} />
          ))}
          {quizQuestions?.length === 0 && (
            <p className="mt-6 text-center text-slate-500 dark:text-slate-400">No quiz questions for this guide.</p>
          )}
        </ul>
      )}
    </div>
  );
}

function FlashcardRow({ card }: { card: Flashcard }) {
  const [front, setFront] = useState(card.front);
  const [back, setBack] = useState(card.back);
  const [saved, setSaved] = useState(true);

  useUnsavedChangesWarning(!saved);

  function update(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setter(e.target.value);
      setSaved(false);
    };
  }

  async function save() {
    await db.flashcards.update(card.id!, { front, back });
    setSaved(true);
  }

  async function remove() {
    if (!window.confirm('Delete this flashcard?')) return;
    await deleteFlashcard(card.id!);
  }

  return (
    <li className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Front
      </label>
      <textarea
        value={front}
        onChange={update(setFront)}
        rows={2}
        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
      />
      <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Back
      </label>
      <textarea
        value={back}
        onChange={update(setBack)}
        rows={2}
        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
      />
      <div className="mt-2 flex justify-end gap-2">
        <button
          onClick={remove}
          className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-rose-400"
        >
          Delete
        </button>
        <button
          onClick={save}
          disabled={saved}
          className="rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40"
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </li>
  );
}

function QuizQuestionRow({ question }: { question: QuizQuestion }) {
  const [text, setText] = useState(question.question);
  const [choices, setChoices] = useState([...question.choices]);
  const [correctIndex, setCorrectIndex] = useState(question.correctIndex);
  const [saved, setSaved] = useState(true);

  useUnsavedChangesWarning(!saved);

  function updateChoice(i: number, value: string) {
    setChoices((prev) => prev.map((c, idx) => (idx === i ? value : c)));
    setSaved(false);
  }

  async function save() {
    await db.quizQuestions.update(question.id!, { question: text, choices, correctIndex });
    setSaved(true);
  }

  async function remove() {
    if (!window.confirm('Delete this quiz question?')) return;
    await db.quizQuestions.delete(question.id!);
  }

  return (
    <li className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3">
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Question
      </label>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        rows={2}
        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-sm text-slate-900 dark:text-slate-100"
      />
      <label className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Choices (select the correct one)
      </label>
      <div className="mt-1 space-y-1.5">
        {choices.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="radio"
              checked={correctIndex === i}
              onChange={() => {
                setCorrectIndex(i);
                setSaved(false);
              }}
            />
            <input
              value={c}
              onChange={(e) => updateChoice(i, e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <button
          onClick={remove}
          className="rounded-lg bg-slate-200 dark:bg-slate-700 px-3 py-1.5 text-xs font-medium text-rose-400"
        >
          Delete
        </button>
        <button
          onClick={save}
          disabled={saved}
          className="rounded-lg bg-violet-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-40"
        >
          {saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </li>
  );
}
