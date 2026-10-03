import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { importDocxGuide } from '../lib/importGuide';
import { db } from '../db/db';

const CERT_SUGGESTIONS = ['Security+', 'Network+', 'A+', 'CCNA', 'AWS SAA', 'Linux+', 'PMP'];

interface PendingFile {
  file: File;
  certification: string;
}

/** Derives a certification label from a folder-import's relative path, e.g.
 * "TECH FOLDER/CCNA/CCNA 200-301.docx" -> "CCNA". Falls back for files
 * sitting directly in the selected root folder. */
function certFromRelativePath(file: File): string {
  const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
  if (!relPath) return 'Uncategorized';
  const parts = relPath.split('/');
  return parts.length >= 3 ? parts[1] : 'Uncategorized';
}

export default function Import() {
  const [certification, setCertification] = useState('');
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const navigate = useNavigate();
  const folderInputRef = useRef<HTMLInputElement>(null);

  function pickFiles(fileList: FileList | null) {
    const docxFiles = Array.from(fileList ?? []).filter((f) => f.name.toLowerCase().endsWith('.docx'));
    setPending(docxFiles.map((file) => ({ file, certification: certFromRelativePath(file) })));
    setLog([]);
  }

  async function handleImport() {
    if (pending.length === 0) return;
    setBusy(true);
    setProgress(0);
    setLog([]);
    let lastGuideId: number | null = null;
    const existingFileNames = new Set(
      (await db.guides.toArray()).map((g) => g.sourceFileName),
    );

    for (const { file, certification: detectedCert } of pending) {
      const cert = detectedCert !== 'Uncategorized' ? detectedCert : certification || 'Uncategorized';
      if (existingFileNames.has(file.name)) {
        setLog((prev) => [...prev, `⏭️ [${cert}] ${file.name}: already imported, skipped`]);
        setProgress((p) => p + 1);
        continue;
      }
      try {
        const result = await importDocxGuide(file, cert);
        lastGuideId = result.guideId;
        existingFileNames.add(file.name);
        setLog((prev) => [
          ...prev,
          `✅ [${cert}] ${file.name}: ${result.topicCount} topics, ${result.flashcardCount} flashcards, ${result.quizQuestionCount} quiz questions`,
        ]);
      } catch (err) {
        setLog((prev) => [...prev, `❌ [${cert}] ${file.name}: ${(err as Error).message}`]);
      }
      setProgress((p) => p + 1);
    }

    setBusy(false);
    setPending([]);
    if (lastGuideId !== null && pending.length === 1) {
      setTimeout(() => navigate(`/guide/${lastGuideId}`), 800);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 pb-10">
      <h1 className="text-xl font-bold">Import study guides</h1>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Everything is parsed on your device — nothing is uploaded anywhere.
      </p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Option A — Import your whole TECH FOLDER at once
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Select the top-level folder once; each subfolder name (e.g. "CCNA", "CISSP") becomes the
        certification label automatically.
      </p>
      <label className="mt-3 block rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          // non-standard attributes, only recognized by Chromium-based browsers
          {...({ webkitdirectory: 'true', directory: 'true' } as Record<string, string>)}
          onChange={(e) => pickFiles(e.target.files)}
        />
        <span className="block text-3xl">🗂️</span>
        <span className="mt-2 block text-slate-600 dark:text-slate-300">
          {pending.length > 0
            ? `${pending.length} .docx file(s) found`
            : 'Tap to choose the TECH FOLDER'}
        </span>
      </label>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Option B — Import specific files
      </h2>
      <label className="mt-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
        Certification / topic (used for files not inside a recognizable subfolder)
      </label>
      <input
        value={certification}
        onChange={(e) => setCertification(e.target.value)}
        placeholder="e.g. Security+"
        list="cert-suggestions"
        className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
      />
      <datalist id="cert-suggestions">
        {CERT_SUGGESTIONS.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <label className="mt-3 block rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
        <input
          type="file"
          accept=".docx"
          multiple
          className="hidden"
          onChange={(e) => pickFiles(e.target.files)}
        />
        <span className="block text-3xl">📄</span>
        <span className="mt-2 block text-slate-600 dark:text-slate-300">Tap to choose individual .docx files</span>
      </label>

      <button
        onClick={handleImport}
        disabled={busy || pending.length === 0}
        className="mt-5 w-full rounded-lg bg-sky-500 py-3 font-semibold text-slate-950 disabled:opacity-40"
      >
        {busy
          ? `Importing… (${progress}/${pending.length})`
          : `Import ${pending.length || ''} guide${pending.length === 1 ? '' : 's'}`.trim()}
      </button>

      {log.length > 0 && (
        <ul className="mt-4 max-h-96 space-y-1 overflow-y-auto text-sm">
          {log.map((l, i) => (
            <li key={i} className="text-slate-600 dark:text-slate-300">
              {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
