import fs from "fs";
import path from "path";

export interface WordData {
  word: string;
  part_of_speech: string;
  definition: string;
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
        word: parts[0],
        part_of_speech: parts[1],
        definition: parts.slice(2).join(",").trim(),
      });
    }
  }
  return words;
}

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

export function getWordsForDay(
  daysSinceEpoch: number,
  words: WordData[]
): [WordData, WordData] | null {
  if (words.length === 0) return null;
  const total = words.length;
  let idx1 = (daysSinceEpoch * 2) % total;
  let idx2 = (daysSinceEpoch * 2 + 1) % total;
  if (idx1 < 0) idx1 += total;
  if (idx2 < 0) idx2 += total;

  return [words[idx1], words[idx2]];
}
