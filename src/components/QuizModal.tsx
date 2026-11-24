import { useState } from 'react';
import { CheckCircle2, RotateCcw, X, XCircle } from 'lucide-react';
import { QUIZ_QUESTIONS } from '../types/lab';

interface QuizModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuizModal({ open, onClose }: QuizModalProps) {
  const [index, setIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!open) return null;

  const q = QUIZ_QUESTIONS[index];
  const answered = selectedOption !== null;
  const isCorrect = selectedOption === q.correctIndex;

  const handleSelect = (optIdx: number) => {
    if (answered) return;
    setSelectedOption(optIdx);
    if (optIdx === q.correctIndex) {
      setScore((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    if (index + 1 < QUIZ_QUESTIONS.length) {
      setIndex((i) => i + 1);
      setSelectedOption(null);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setIndex(0);
    setSelectedOption(null);
    setScore(0);
    setFinished(false);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 p-4 pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label="Uji Pemahaman IPAS Kelas 5"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-[#0f172a] p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <p className="text-xs text-slate-400">IPAS Kelas 5 · Kurikulum Merdeka</p>
            <h2 className="text-base font-bold text-slate-50">Uji Pemahaman Cahaya &amp; Bunyi</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup kuis"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {finished ? (
          <div className="py-6 text-center space-y-4">
            <p className="text-xs font-medium text-slate-400">Hasil Latihan</p>
            <div className="font-mono-num text-4xl font-bold text-amber-400">
              {score} / {QUIZ_QUESTIONS.length}
            </div>
            <p className="text-sm text-slate-200 max-w-sm mx-auto leading-relaxed">
              {score === QUIZ_QUESTIONS.length
                ? 'Luar biasa! Kamu sudah memahami seluruh sifat cahaya dan bunyi dengan sangat baik.'
                : score >= 3
                  ? 'Bagus sekali! Coba ulangi eksperimen di meja 3D untuk memperdalam materi yang masih keliru.'
                  : 'Terus semangat belajar! Sentuh dan coba setiap alat di laboratorium 3D lalu ulangi kuis ini.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleRestart}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Ulangi Kuis</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Kembali ke Lab 3D
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono-num">
                Soal {index + 1} dari {QUIZ_QUESTIONS.length}
              </span>
              <span className="font-mono-num text-amber-300">Benar: {score}</span>
            </div>

            <p className="text-sm font-medium leading-relaxed text-slate-100">{q.question}</p>

            <div className="space-y-2">
              {q.options.map((opt, idx) => {
                let style =
                  'border-slate-700/90 bg-[#162238] text-slate-200 hover:border-slate-500 hover:bg-[#1d2d4a]';
                if (answered) {
                  if (idx === q.correctIndex) {
                    style = 'border-emerald-500 bg-emerald-950/60 text-emerald-100';
                  } else if (idx === selectedOption) {
                    style = 'border-rose-500 bg-rose-950/60 text-rose-100';
                  } else {
                    style = 'border-slate-800 bg-[#121b2d] text-slate-400';
                  }
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    disabled={answered}
                    onClick={() => handleSelect(idx)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-left text-xs sm:text-sm transition-colors ${style}`}
                  >
                    <span>{opt}</span>
                    {answered && idx === q.correctIndex && (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    )}
                    {answered && idx === selectedOption && idx !== q.correctIndex && (
                      <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {answered && (
              <div className="rounded-lg border border-slate-700 bg-[#142034] p-3 text-xs leading-relaxed text-slate-200">
                <span className={isCorrect ? 'font-bold text-emerald-400' : 'font-bold text-rose-400'}>
                  {isCorrect ? 'Tepat! ' : 'Belum tepat. '}
                </span>
                {q.explanation}
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={!answered}
                onClick={handleNext}
                className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {index + 1 < QUIZ_QUESTIONS.length ? 'Soal Berikutnya' : 'Lihat Hasil'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
