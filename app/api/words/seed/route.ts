import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getWords } from "@/lib/words";

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedSecret) {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const allWords = getWords();
  if (allWords.length < 2) {
    return NextResponse.json({ error: "Not enough words in CSV" }, { status: 400 });
  }

  // Clear existing history to pretend we are starting fresh
  await prisma.dailyWord.deleteMany({});

  // Pretend today is exactly day 30 and generate a past history without replacement
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  // We loop from 30 days ago up to today...
  let wordIndex = 0;
  const createdDays = [];

  for (let pastDays = 30; pastDays >= 0; pastDays--) {
    // Determine the historical date for this iteration
    const historicalDate = new Date(today);
    historicalDate.setUTCDate(today.getUTCDate() - pastDays);

    // Pick two unchosen words
    const w1 = allWords[wordIndex % allWords.length];
    wordIndex++;
    const w2 = allWords[wordIndex % allWords.length];
    wordIndex++;

    await prisma.dailyWord.create({
      data: {
        date: historicalDate,
        word1: w1.word,
        word2: w2.word,
      },
    });

    createdDays.push({ date: historicalDate, word1: w1.word, word2: w2.word });
  }

  return NextResponse.json({ 
    message: "Successfully seeded 30 days of unchosen words.",
    todayWords: createdDays.find(d => d.date.getTime() === today.getTime()),
    history: createdDays
  });
}