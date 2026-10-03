import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db, type QuizQuestion } from '../db/db';

interface MissedQuestion {
  question: QuizQuestion;
  chosenIndex: number;
}

const MAX_SESSION_SIZE = 20;

export default function Quiz() {
  const { guideId } = useParams();
  const isAll = guideId === 'all';
  const id = isAll ? null : Number(guideId);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [guideTitles, setGuideTitles] = useState<Map<number, string>>(new Map());
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState<MissedQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    if (isAll) {
      db.quizQuestions.toArray().then(async (qs) => {
        const shuffled = [...qs].sort(() => Math.random() - 0.5).slice(0, MAX_SESSION_SIZE);
        const guideIds = [...new Set(shuffled.map((q) => q.guideId))];
        const guides = await db.guides.bulkGet(guideIds);
        setGuideTitles(new Map(guides.filter(Boolean).map((g) => [g!.id!, g!.title])));
        setQuestions(shuffled);
        setLoading(false);
      });
    } else {
      db.quizQuestions
        .where('guideId')
        .equals(id as number)
        .toArray()
        .then((qs) => {
          setQuestions([...qs].sort(() => Math.random() - 0.5));
          setLoading(false);
        });
    }
  }, [id, isAll]);

  function choose(choiceIndex: number) {
    if (selected !== null) return;
    setSelected(choiceIndex);
    if (choiceIndex === questions[index].correctIndex) {
      setCorrectCount((c) => c + 1);
    } else {
      setMissed((m) => [...m, { question: questions[index], chosenIndex: choiceIndex }]);
    }
  }

  async function next() {
    if (index + 1 >= questions.length) {
      // Mixed cross-guide sessions aren't tied to one guide, so they aren't
      // recorded in the per-guide quiz history.
      if (!isAll) {
        await db.quizAttempts.add({
          guideId: id as number,
          takenAt: Date.now(),
          totalQuestions: questions.length,
          correctCount,
        });
      }
      setFinished(true);
      return;
    }
    setSelected(null);
    setIndex((i) => i + 1);
  }

  // Keyboard shortcuts: 1-4 pick an answer, Space/Enter advances once answered.
  useEffect(() => {
    if (loading || finished || questions.length === 0) return;
    function onKeyDown(e: KeyboardEvent) {
      const choiceCount = questions[index]?.choices.length ?? 0;
      if (['1', '2', '3', '4'].includes(e.key) && Number(e.key) <= choiceCount) {
        e.preventDefault();
        choose(Number(e.key) - 1);
      } else if ((e.key === ' ' || e.key === 'Enter') && selected !== null) {
        e.preventDefault();
        next();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, finished, questions, index, selected]);

  if (loading) return null;

  const backLink = isAll ? '/' : `/guide/${id}`;
  const backLabel = isAll ? 'Back to dashboard' : 'Back to guide';

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 text-center">
        <p className="text-slate-500 dark:text-slate-400">
          {isAll
            ? 'No quiz questions available yet — import a guide first.'
            : 'Not enough content to generate a quiz for this guide yet.'}
        </p>
        <Link to={backLink} className="mt-5 inline-block text-sky-400 underline">
          {backLabel}
        </Link>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="mx-auto max-w-xl px-4 pt-10">
        <div className="text-center">
          <p className="text-4xl">{pct >= 80 ? '🏆' : pct >= 50 ? '👍' : '📖'}</p>
          <p className="mt-3 text-lg font-semibold">
            Score: {correctCount}/{questions.length} ({pct}%)
          </p>
          <Link to={backLink} className="mt-5 inline-block text-sky-400 underline">
            {backLabel}
          </Link>
        </div>

        {missed.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Review missed questions ({missed.length})
            </h2>
            <ul className="mt-3 space-y-3">
              {missed.map((m, i) => (
                <li key={i} className="rounded-lg bg-slate-100 dark:bg-slate-800 p-4">
                  <p className="font-medium">{m.question.question}</p>
                  <p className="mt-2 text-sm text-rose-400">
                    Your answer: {m.question.choices[m.chosenIndex]}
                  </p>
                  <p className="mt-1 text-sm text-emerald-400">
                    Correct answer: {m.question.choices[m.question.correctIndex]}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const q = questions[index];
  const guideTitle = isAll ? guideTitles.get(q.guideId) : null;

  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>
          Question {index + 1} of {questions.length}
        </span>
        <Link to={backLink} className="underline">
          Exit
        </Link>
      </div>
      {isAll && guideTitle && (
        <p className="mt-1 truncate text-xs font-medium text-sky-400">{guideTitle}</p>
      )}

      <p className="mt-4 text-lg font-semibold">{q.question}</p>

      <div className="mt-4 space-y-2">
        {q.choices.map((choice, i) => {
          const isCorrect = i === q.correctIndex;
          const isSelected = i === selected;
          let style = 'bg-slate-100 dark:bg-slate-800';
          if (selected !== null) {
            if (isCorrect) style = 'bg-emerald-600';
            else if (isSelected) style = 'bg-rose-600';
          }
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left ${style}`}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-black/20 text-xs font-semibold">
                {i + 1}
              </span>
              {choice}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <button
          onClick={next}
          className="mt-5 w-full rounded-lg bg-sky-500 py-3 font-semibold text-slate-950"
        >
          {index + 1 >= questions.length ? 'Finish' : 'Next question'}
          <span className="ml-2 text-xs font-normal opacity-75">(Space)</span>
        </button>
      )}
    </div>
  );
}
