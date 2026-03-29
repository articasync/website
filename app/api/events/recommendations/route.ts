import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isSingle = searchParams.get("single") === "true";
    const countToGenerate = isSingle ? 1 : 5;

    // 1. Fetch past interactions (ratings, pins)
    const history = await prisma.eventInteraction.findMany({
      orderBy: { createdAt: "desc" },
      take: 20, // get the last 20 interactions for context
    });

    // 2. Fetch general guidance
    const guidanceSetting = await prisma.setting.findUnique({
      where: { key: "event_guidance" },
    });
    const guidance = guidanceSetting?.value || "";

    // 3. Construct prompt context
    const historyContext = history.map((h: any) => 
      `- ${h.title} (Rating: ${h.rating ?? "N/A"}, Reason: ${h.reason ?? "N/A"}, Pinned: ${h.pinned}, Skipped: ${h.skipped})`
    ).join("\n");

    const prompt = `
Generate ${countToGenerate} event recommendation(s) in New York City. 

Here is the user's general curation guidance:
"${guidance}"

Here are their past interactions for pattern weights (Exploit what they like and Explore adjacent interests):
${historyContext}

Consider the following sources of events as inspiration (pull from similar types of events or check these style listings):
- Timeout This Weekend: https://www.timeout.com/newyork/things-to-do/things-to-do-in-nyc-this-weekend 
- The Skint: https://www.theskint.com/
- Secret NYC: https://secretnyc.co/what-to-do-this-weekend-nyc/
- NYC Resistor Calendar: https://www.nycresistor.com/calendar/
- Simons Foundation Lectures, Thought Gallery, Interintellect, Center for Fiction, Grolier Club.

Output the result as a strict JSON array of objects with these exact keys: "id" (generate a unique string), "title", "description", and "time".
`;

    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash", // Use the latest fast model
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    
    // Safely parse JSON
    const data = JSON.parse(text);

    return NextResponse.json(data);

  } catch (e: any) {
    console.error("Gemini Recommendations failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
