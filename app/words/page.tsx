import { getWords, getWordsForDayFromDB, WordData } from "@/lib/words";
import React from "react";

export const dynamic = 'force-dynamic';

export default async function WordsPage() {
  const words = getWords();
  
  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-gray-500">Please populate words_full_info.csv to see words of the day.</div>
      </div>
    );
  }

  const today = new Date();
  
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setUTCDate(today.getUTCDate() - 7);

  const monthAgo = new Date(today);
  monthAgo.setUTCDate(today.getUTCDate() - 30);

  const todayWords = await getWordsForDayFromDB(today, words, true);
  const yesterdayWords = await getWordsForDayFromDB(yesterday, words, false);
  const weekAgoWords = await getWordsForDayFromDB(weekAgo, words, false);
  const monthAgoWords = await getWordsForDayFromDB(monthAgo, words, false);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
        Daily Vocabulary
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <DaySection title="Today" words={todayWords} highlight />
        <DaySection title="Yesterday" words={yesterdayWords} />
        <DaySection title="7 Days Ago" words={weekAgoWords} />
        <DaySection title="30 Days Ago" words={monthAgoWords} />
      </div>
    </div>
  );
}

function DaySection({ title, words, highlight = false }: { title: string, words: [WordData, WordData] | null, highlight?: boolean }) {
  if (!words) {
    return (
      <div className={`p-6 rounded-2xl shadow-sm border ${highlight ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-100'}`}>
        <h2 className={`text-2xl font-bold mb-4 ${highlight ? 'text-indigo-800' : 'text-gray-400'}`}>{title}</h2>
        <div className="text-gray-400 italic text-center py-8">Words not generated yet.</div>
      </div>
    );
  }
  return (
    <div className={`p-6 rounded-2xl shadow-sm border ${highlight ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100'}`}>
      <h2 className={`text-2xl font-bold mb-4 ${highlight ? 'text-indigo-800' : 'text-gray-700'}`}>{title}</h2>
      <div className="space-y-4">
        {words.map((w, idx) => (
          <WordCard key={idx} wordData={w} />
        ))}
      </div>
    </div>
  );
}

function WordCard({ wordData }: { wordData: WordData }) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
      <div className="flex items-baseline gap-2 mb-4 border-b border-gray-100 pb-3">
        <span className="text-2xl font-bold text-gray-800 capitalize">{wordData.word}</span>
        <span className="text-sm font-medium text-gray-500 italic">({wordData.part_of_speech})</span>
      </div>
      
      <div className="space-y-4">
        {wordData.definitions && wordData.definitions.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-2">Definition</h4>
            <ul className="list-disc pl-5 text-gray-700 space-y-1 marker:text-indigo-300">
              {wordData.definitions.map((def, i) => (
                <li key={i} className="leading-relaxed">{def}</li>
              ))}
            </ul>
          </div>
        )}
        
        {wordData.examples && wordData.examples.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-orange-500 uppercase tracking-widest mb-2">Examples</h4>
            <ul className="list-disc pl-5 text-gray-600 italic space-y-1 marker:text-orange-300">
              {wordData.examples.map((ex, i) => (
                <li key={i} className="leading-relaxed">"{ex}"</li>
              ))}
            </ul>
          </div>
        )}

        {wordData.synonyms && (
          <div>
            <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-2">Synonyms</h4>
            <p className="text-gray-700 leading-relaxed text-sm bg-emerald-50 rounded-lg p-3 border border-emerald-100">
              {wordData.synonyms}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
