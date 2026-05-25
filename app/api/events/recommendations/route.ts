import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countToGenerate = 10; // Batch size of 10 to save API requests

    // 1. Fetch past interactions (ratings, pins)
    const history = await prisma.eventInteraction.findMany({
      orderBy: { createdAt: "desc" },
    });

    const guidance = searchParams.get("guidance") || "";

    // 3. Construct prompt context
    const pinned = history.filter((h: any) => h.pinned);
    const skipped = history.filter((h: any) => h.skipped);

    const pinnedContext = pinned.map((h: any) => `- ${h.title} (Reason: ${h.reason ?? "N/A"})`).join("\n");
    const skippedContext = skipped.map((h: any) => `- ${h.title} (Reason skipped: ${h.reason ?? "N/A"})`).join("\n");

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemInstruction = `Return ONLY a valid JSON array. Do not include any introductory text, conversational filler, or Markdown code blocks (like \`\`\`json). Start the response with [ and end it with ].`;

    const prompt = `Generate ${countToGenerate} event recommendation(s) in New York City. 

CURRENT REFERENCE DATE: ${today}.
CRITICAL: You MUST use the Google Search tool to find REAL, upcoming events. Do not rely on training data for dates or links. 

### PREFERRED TARGET SOURCES & NYC VENUES:
1. SEARCH PLATFORMS: Actively look for upcoming concerts, underground shows, and music events on:
   - Resident Advisor (residentadvisor.net)
   - Bandcamp (bandcamp.com)
   - EDMTrain (edmtrain.com)
2. SPECIFIC NYC VENUES: Actively check and search calendars for real local venues, such as:
   - Brooklyn Steel, Elsewhere, Avant Gardner / The Brooklyn Mirage, Knockdown Center
   - Webster Hall, Bowery Ballroom, Music Hall of Williamsburg, TV Eye, Baby's All Right, Pioneer Works, Union Pool, etc.
   Formulate targeted Google Search queries using these platforms and venues to retrieve accurate real-time listings.

### EVENT CRITERIA:
1. DATE ACCURACY: All recommended events MUST take place on or after ${today}.
   - CRITICAL: You must verify that the search snippet explicitly mentions the correct year. Do not recommend past events or assume an annual event from last year is happening on the same exact day this year.
2. UNIQUENESS: Focus on limited-time, unique, pop-up, or one-off events (guest lectures, concerts, weekend fairs). 
   - DESCRIPTION: Provide an elaborately detailed description (roughly 100-150 words) that explains what is happening and why it is interesting.
3. EXCLUSIONS: Avoid permanent attractions, long-running Broadway shows, or standard tourist traps.
4. LINK INTEGRITY: Every event MUST have a verified DEEP LINK. 
   - You MUST extract the exact URL string directly from the Google Search results snippet.
   - NEVER construct, guess, or predict a URL path (e.g., do not guess Eventbrite URL slugs).
   - NEVER output a general homepage (like "theskint.com").
   - If the search results do not provide a direct, full URL to the exact event, DO NOT suggest the event.

### USER CONTEXT:
- General Guidance: "${guidance}"
- PINNED (Planned): ${pinnedContext}
- SKIPPED (Avoid): ${skippedContext}

### USER COMPREHENSION STEP:
Before generating recommendations, analyze the user's history below. 
- Identify clear patterns (e.g., does the user prefer indoor vs outdoor events? Live music vs comedy? Specific neighborhoods vs general NYC?).
- Determine what venues and types of events they explicitly SKIPPED.
- Use this mental profile to give more targeted guidance and avoid past failures, but still leave 20% room for exploration to keep things fresh.

### ANALYSIS RULES:
- Do NOT suggest any event titles that already appear in the user's history.
- Analyze SKIPPED events to identify negative signals.
- Use PINNED events to find adjacent interests or similar venues.
- Balance relevance with how soon the event is upcoming. Again, only suggest events that are taking place on or after ${today}.

### OUTPUT FORMAT:
Output as a strict JSON array of objects with these exact keys: 
"id" (unique string), 
"title", 
"description", 
"time" (Format: 'Weekday, Month Day, Year, Time'), 
"search_rationale" (Briefly state the exact website source AND quote the exact date/year mentioned in the search snippet to prove it is upcoming),
"link" (CRITICAL: You MUST output a Google Search URL formatted EXACTLY like this: https://www.google.com/search?q=Event+Name+Venue+NYC+Tickets. Replace spaces with +. Only provide this Google Search link.),
"why" (Provide an in-depth explanation of why this aligns with their profile, referencing their pins/skips and explaining why it fits and was selected for them).
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2, // LOWERED: crucial for exact URL strings
        tools: [
          {
            googleSearch: {}
          }
        ]
      }
    });

    let text = response.text || "";
    
    // Safety check: Strip markdown code blocks if the model ignored the "no-markdown" rule
    if (typeof text === "string") {
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\n/, '').replace(/\n```$/, '');
      }
      text = text.trim();
    } else {
      text = JSON.stringify(text); // Fallback if it's already an object
    }
    console.log("Raw Gemini Text:", text);
    
    let eventsArray: any[] = [];
    try {
      const data = JSON.parse(text);
      eventsArray = Array.isArray(data) ? data : [];
    } catch (e) {
      console.error("Model output was not valid JSON:", text);
    }
    
    console.log(`Returning ${eventsArray.length} items from Gemini (Server-side validation bypassed).`);

    return NextResponse.json(eventsArray);

  } catch (e: any) {
    console.error("Gemini Recommendations failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
