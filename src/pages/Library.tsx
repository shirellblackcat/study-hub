import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db, type StudyGuide } from '../db/db';
import { exportBackup, importBackup } from '../lib/backup';
import { exportProgressReport } from '../lib/exportReport';

export default function Library() {
  const guides = useLiveQuery(() => db.guides.orderBy('createdAt').reverse().toArray(), [], []);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImportBackup(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      await importBackup(file);
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const q = query.trim().toLowerCase();
  const filtered = (guides ?? []).filter(
    (g) => !q || g.title.toLowerCase().includes(q) || g.certification.toLowerCase().includes(q),
  );

  const grouped = filtered.reduce<Record<string, StudyGuide[]>>((acc, g) => {
    (acc[g.certification] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Library</h1>
        <div className="flex flex-wrap justify-end gap-2 text-xs">
          <button
            onClick={() => exportProgressReport()}
            disabled={!guides || guides.length === 0}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 font-medium text-slate-800 dark:text-slate-200 disabled:opacity-40"
          >
            Export progress
          </button>
          <button
            onClick={() => exportBackup()}
            disabled={!guides || guides.length === 0}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 font-medium text-slate-800 dark:text-slate-200 disabled:opacity-40"
          >
            Export backup
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2 font-medium text-slate-800 dark:text-slate-200 disabled:opacity-40"
          >
            {busy ? 'Restoring…' : 'Restore backup'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => handleImportBackup(e.target.files?.[0])}
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        Export a backup on this device, then use "Restore backup" on your phone to bring all
        guides, flashcards, and quizzes over.
      </p>

      {guides && guides.length === 0 && (
        <p className="mt-4 text-slate-500 dark:text-slate-400">
          No guides yet.{' '}
          <Link to="/import" className="text-sky-400 underline">
            Import one
          </Link>
          .
        </p>
      )}

      {guides && guides.length > 0 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by title or certification…"
          className="mt-4 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
        />
      )}

      {q && filtered.length === 0 && (
        <p className="mt-4 text-slate-500 dark:text-slate-400">No guides match "{query}".</p>
      )}

      {Object.entries(grouped).map(([cert, list]) => (
        <div key={cert} className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{cert}</h2>
          <ul className="mt-2 space-y-2">
            {list?.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/guide/${g.id}`}
                  className="block rounded-lg bg-slate-100 dark:bg-slate-800 px-4 py-3 font-medium"
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
