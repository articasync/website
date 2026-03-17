import fs from "fs";
import path from "path";

export interface WordData {
  word: string;
  part_of_speech: string;
  definitions: string[];
  examples: string[];
  synonyms: string;
}

export function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur.trim());
  return result.map((s) => s.replace(/^"|"$/g, ""));
}

export function getWords(): WordData[] {
  const filePath = path.join(process.cwd(), "words_full_info.csv");
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  const startIndex = lines[0]?.toLowerCase().includes("word") ? 1 : 0;

  const words: WordData[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length >= 3) {
      words.push({
        word: parts[0] || "",
        part_of_speech: parts[1] || "",
        definitions: (parts[2] || "").split(";").map(s => s.trim()).filter(Boolean),
        examples: (parts[3] || "").split(";").map(s => s.trim()).filter(Boolean),
        synonyms: parts[4] || "",
      });
    }
  }
  return words;
}

import prisma from "@/lib/prisma";

export function getDaysSinceEpoch(date: Date): number {
  const epoch = new Date("2024-01-01T12:00:00Z").getTime();
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  const d = new Date(`${year}-${month}-${day}T12:00:00Z`).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((d - epoch) / msPerDay);
}

export async function getWordsForDayFromDB(
  date: Date,
  allWords: WordData[],
  allowGenerate: boolean = true
): Promise<[WordData, WordData] | null> {
  if (allWords.length === 0) return null;

  // Normalize date to prevent timezone shifts when checking DB 
  const historicalDate = new Date(date);
  historicalDate.setUTCHours(0, 0, 0, 0);

  const existing = await prisma.dailyWord.findUnique({
    where: { date: historicalDate }
  });

  if (existing) {
    const w1 = allWords.find(w => w.word === existing.word1);
    const w2 = allWords.find(w => w.word === existing.word2);
    
    if (w1 && w2) {
      return [w1, w2];
    }
  }

  if (!allowGenerate) {
    return null;
  }

  // Not in database? Grab all previously chosen words 
  const chosenRecords = await prisma.dailyWord.findMany({
    select: { word1: true, word2: true }
  });

  const chosenSet = new Set<string>();
  chosenRecords.forEach((r: { word1: string; word2: string }) => {
    chosenSet.add(r.word1);
    chosenSet.add(r.word2);
  });

  let unchosen = allWords.filter(w => !chosenSet.has(w.word));
  if (unchosen.length < 2) {
    unchosen = allWords; // Simple recycle behavior
  }

  const w1 = unchosen[0];
  const w2 = unchosen[1];

  await prisma.dailyWord.create({
    data: {
      date: historicalDate,
      word1: w1.word,
      word2: w2.word
    }
  });

  return [w1, w2];
}
