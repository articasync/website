import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getWords, getDaysSinceEpoch, getWordsForDay, WordData } from "@/lib/words";

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

  const today = new Date();
  const daysSinceEpoch = getDaysSinceEpoch(today);

  const formatSingleWord = (w: WordData, index: number) => {
    let result = `${index}. ${w.word.charAt(0).toUpperCase() + w.word.slice(1)}\n`;
    result += `Part of Speech: ${w.part_of_speech}\n`;
    if (w.definitions && w.definitions.length > 0) {
      result += `Definition:\n${w.definitions.join("\n")}\n`;
    }
    if (w.examples && w.examples.length > 0) {
      result += `Example:\n${w.examples.join("\n")}\n`;
    }
    if (w.synonyms) {
      result += `Synonyms: ${w.synonyms}\n`;
    }
    return result.trim();
  };

  const formatWords = (ws: [WordData, WordData] | null) => 
    ws ? `${formatSingleWord(ws[0], 1)}\n\n${formatSingleWord(ws[1], 2)}` : "N/A";

  const todayWords = formatWords(getWordsForDay(daysSinceEpoch, words));
  const yesterdayWords = formatWords(getWordsForDay(daysSinceEpoch - 1, words));
  const weekAgoWords = formatWords(getWordsForDay(daysSinceEpoch - 7, words));
  const monthAgoWords = formatWords(getWordsForDay(daysSinceEpoch - 30, words));

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
