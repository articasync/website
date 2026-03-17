import { getWords, getDaysSinceEpoch, getWordsForDay, WordData } from "@/lib/words";
import React from "react";

export default function WordsPage() {
  const words = getWords();
  
  if (words.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-xl text-gray-500">Please populate words_full_info.csv to see words of the day.</div>
      </div>
    );
  }

  const today = new Date();
  const daysSinceEpoch = getDaysSinceEpoch(today);

  const todayWords = getWordsForDay(daysSinceEpoch, words);
  const yesterdayWords = getWordsForDay(daysSinceEpoch - 1, words);
  const weekAgoWords = getWordsForDay(daysSinceEpoch - 7, words);
  const monthAgoWords = getWordsForDay(daysSinceEpoch - 30, words);

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
  if (!words) return null;
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
    <div className="group relative bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-default">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xl font-bold text-gray-800 capitalize">{wordData.word}</span>
        <span className="text-sm font-medium text-gray-500 italic">{wordData.part_of_speech}</span>
      </div>
      
      {/* Tooltip on hover */}
      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 left-0 bottom-full mb-2 w-full p-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl pointer-events-none z-10">
        <div className="font-semibold mb-1 capitalize">{wordData.word}</div>
        <div className="break-words">{wordData.definition}</div>
        <div className="absolute w-3 h-3 bg-gray-900 transform rotate-45 left-1/2 -ml-1.5 -bottom-1.5"></div>
      </div>
    </div>
  );
}
