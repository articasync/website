import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getWords, getWordsForDayFromDB, WordData } from "@/lib/words";

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get("Authorization");
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedSecret) {
    if (process.env.NODE_ENV !== "development") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const words = getWords();

  if (words.length === 0) {
    return NextResponse.json({ message: "No words available to send." });
  }

  const formatSingleWord = (w: WordData, index: number) => {
    let result = `${index}. ${w.word.charAt(0).toUpperCase() + w.word.slice(1)}\n`;
    result += `Part of Speech: ${w.part_of_speech}\n`;
    if (w.definitions && w.definitions.length > 0) {
      result += `Definition:\n${w.definitions.join("\n")}\n`;
    }
    if (w.examples && w.examples.length > 0) {
      result += `Examples:\n${w.examples.join("\n")}\n`;
    }
    if (w.synonyms) {
      result += `Synonyms: ${w.synonyms}\n`;
    }
    return result.trim();
  };

  const formatWords = (ws: [WordData, WordData] | null) => 
    ws ? `${formatSingleWord(ws[0], 1)}\n\n${formatSingleWord(ws[1], 2)}` : "Words not generated yet.";

  const today = new Date();
  
  const yesterday = new Date(today);
  yesterday.setUTCDate(today.getUTCDate() - 1);

  const weekAgo = new Date(today);
  weekAgo.setUTCDate(today.getUTCDate() - 7);

  const monthAgo = new Date(today);
  monthAgo.setUTCDate(today.getUTCDate() - 30);

  const todayWords = formatWords(await getWordsForDayFromDB(today, words, true));
  const yesterdayWords = formatWords(await getWordsForDayFromDB(yesterday, words, false));
  const weekAgoWords = formatWords(await getWordsForDayFromDB(weekAgo, words, false));
  const monthAgoWords = formatWords(await getWordsForDayFromDB(monthAgo, words, false));

  const subject = `Words of the Day - ${today.toLocaleDateString("en-US", { timeZone: "America/New_York" })}`;
  
  const content = `Here are your words of the day!

=== Today ===
${todayWords}

=== Yesterday ===
${yesterdayWords}

=== 7 Days Ago ===
${weekAgoWords}

=== 30 Days Ago ===
${monthAgoWords}

Enjoy your daily vocabulary!
`;

  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL as string || "onboarding@resend.dev",
      to: ["mariamabdullahedu@gmail.com"],
      subject: subject,
      text: content,
    });
    
    return NextResponse.json({ status: "ok", message: "Email sent successfully." });
  } catch (error) {
    console.error("Failed to send words of the day email", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
