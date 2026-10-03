import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { Link } from 'react-router-dom';
import { db } from '../db/db';

interface SearchableTopic {
  guideId: number;
  topicId: number;
  guideTitle: string;
  heading: string;
  content: string;
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [data, setData] = useState<SearchableTopic[]>([]);

  useEffect(() => {
    (async () => {
      const guides = await db.guides.toArray();
      const guideMap = new Map(guides.map((g) => [g.id!, g.title]));
      const topics = await db.topics.toArray();
      setData(
        topics.map((t) => ({
          guideId: t.guideId,
          topicId: t.id!,
          guideTitle: guideMap.get(t.guideId) ?? 'Unknown guide',
          heading: t.heading,
          content: t.content,
        })),
      );
    })();
  }, []);

  // Fuzzy search over full topic content is expensive (hundreds of ms across
  // thousands of topics) — debounce so it only runs once the user pauses,
  // not on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(t);
  }, [query]);

  const fuse = useMemo(
    () =>
      new Fuse(data, {
        keys: ['heading', 'content', 'guideTitle'],
        threshold: 0.35,
        ignoreLocation: true,
      }),
    [data],
  );

  const results = useMemo(
    () => (debouncedQuery.trim() ? fuse.search(debouncedQuery).slice(0, 30) : []),
    [fuse, debouncedQuery],
  );
  const isSearching = query !== debouncedQuery && query.trim().length > 0;

  return (
    <div className="mx-auto max-w-xl px-4 pt-6">
      <h1 className="text-xl font-bold">Search</h1>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search across all your guides…"
        aria-label="Search across all your guides"
        className="mt-3 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
      />
      {isSearching && <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Searching…</p>}

      <ul className="mt-4 space-y-2">
        {results.map(({ item }) => (
          <li key={`${item.guideId}-${item.topicId}`}>
            <Link to={`/guide/${item.guideId}?topic=${item.topicId}`} className="block rounded-lg bg-slate-100 dark:bg-slate-800 p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{item.guideTitle}</p>
              <p className="font-medium text-sky-400">{item.heading}</p>
              <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{item.content}</p>
            </Link>
          </li>
        ))}
        {!isSearching && debouncedQuery.trim() && results.length === 0 && (
          <p className="mt-4 text-slate-500 dark:text-slate-400">No matches found.</p>
        )}
      </ul>
    </div>
  );
}
