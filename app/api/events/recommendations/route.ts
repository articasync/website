import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ai = new GoogleGenAI({});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countToGenerate = 5; // Batch size of 5 to make response much faster and avoid timeouts

    // 1. Fetch past interactions (ratings, pins)
    const history = await prisma.eventInteraction.findMany({
      orderBy: { createdAt: "desc" },
    });

    const guidance = searchParams.get("guidance") || "";
    const excludeParam = searchParams.get("exclude") || "";
    let excludeList: string[] = [];
    if (excludeParam) {
      try {
        excludeList = JSON.parse(excludeParam);
      } catch (e) {
        excludeList = excludeParam.split(",").map(t => t.trim()).filter(Boolean);
      }
    }

    // 3. Construct prompt context
    const pinned = history.filter((h: any) => h.pinned);
    const skipped = history.filter((h: any) => h.skipped);

    const pinnedContext = pinned.map((h: any) => `- ${h.title} (Reason: ${h.reason ?? "N/A"})`).join("\n");
    const skippedContext = skipped.map((h: any) => `- ${h.title} (Reason skipped: ${h.reason ?? "N/A"})`).join("\n");

    const excludeContext = excludeList.length > 0
      ? `\n- ADDITIONAL EXCLUDED EVENT TITLES (Do NOT recommend these under any circumstances): ${excludeList.map((t: string) => `"${t}"`).join(", ")}`
      : "";

    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemInstruction = `Return ONLY a valid JSON array. Do not include any introductory text, conversational filler, or Markdown code blocks (like \`\`\`json). Start the response with [ and end it with ].`;

    const prompt = `Generate ${countToGenerate} event recommendation(s) in New York City. 

CURRENT REFERENCE DATE: ${today}.
CRITICAL: You MUST use the Google Search tool to find REAL, upcoming events. Do not rely on training data for dates or links. 

### PREFERRED TARGET SOURCES & NYC VENUES:
1. MUSIC & NIGHTLIFE PLATFORMS: Search for upcoming concerts, underground shows, and music events on:
   - Resident Advisor (residentadvisor.net)
   - Bandcamp (bandcamp.com)
   - EDMTrain (edmtrain.com)
2. SPECIFIC MUSIC & PERFORMANCE VENUES: Check calendars for local music and night venues (e.g., Brooklyn Steel, Elsewhere, Avant Gardner / The Brooklyn Mirage, Knockdown Center, Webster Hall, Bowery Ballroom, Music Hall of Williamsburg, TV Eye, Baby's All Right, Pioneer Works, Union Pool, etc.).
3. OTHER CULTURAL & DIVERSE EVENT PLATFORMS: To ensure a rich variety beyond music and concerts, actively search for other event types (e.g., art openings, street fairs, tech/maker workshops, food markets, guest lectures, design exhibitions, comedy shows, theater events, literary readings) on platforms like:
   - TimeOut New York (timeout.com/newyork)
   - The Skint (theskint.com)
   - Nonsense NYC (nonsensenyc.com)
   - Brooklyn Paper or local NYC event boards
   - Museum calendars (e.g., MoMA, Brooklyn Museum, Whitney, Cooper Hewitt)
   - Cultural centers (e.g., Lincoln Center, BAM, Park Avenue Armory)
   Formulate diverse Google Search queries using these platforms and venues to retrieve a wide variety of accurate real-time listings.

### DIVERSITY & EXPLORATION BALANCE:
- CRITICAL MIX (NO SPECIFIC FOCUS): If the "General Guidance" under USER CONTEXT is empty or highly generic, you MUST maintain a balanced, rich mix of event types (e.g., 40% music/shows, 30% art/culture/exhibits, 30% learning/workshops/exploration/pop-ups) and include at least 1-2 completely "exploratory" or unique niche events to keep recommendations fresh and unexpected.
- FOCUS OVERRIDE: If a specific "General Guidance" focus is provided (e.g., a specific topic, genre, neighborhood, or type of event like "jazz", "art openings", "comedy"), do NOT try to force a blend of different activity types or search sources. Focus 100% purely on the specified focus! If they ask for music/concerts, generate ONLY music/concert recommendations. If they ask for art, generate ONLY art recommendations. Do not mix other activity types into a specific focus query.

### EVENT CRITERIA:
1. DATE ACCURACY: All recommended events MUST take place on or after ${today}.
   - CRITICAL: You must verify that the search snippet explicitly mentions the correct year. Do not recommend past events or assume an annual event from last year is happening on the same exact day this year.
2. UNIQUENESS: Focus on limited-time, unique, pop-up, or one-off events (guest lectures, concerts, weekend fairs). 
   - DESCRIPTION: Provide a concise yet detailed description (roughly 40-60 words) that explains what is happening and why it is interesting.
3. EXCLUSIONS: Avoid permanent attractions, long-running Broadway shows, or standard tourist traps.
4. LINK INTEGRITY: Every event MUST have a verified DEEP LINK. 
   - You MUST extract the exact URL string directly from the Google Search results snippet.
   - NEVER construct, guess, or predict a URL path (e.g., do not guess Eventbrite URL slugs).
   - NEVER output a general homepage (like "theskint.com").
   - If the search results do not provide a direct, full URL to the exact event, DO NOT suggest the event.

### USER CONTEXT:
- General Guidance: "${guidance}"
- PINNED (Planned): ${pinnedContext}
- SKIPPED (Avoid): ${skippedContext}${excludeContext}

### USER COMPREHENSION STEP:
Before generating recommendations, analyze the user's history below. 
- Identify clear patterns (e.g., does the user prefer indoor vs outdoor events? Live music vs comedy? Specific neighborhoods vs general NYC?).
- Determine what venues and types of events they explicitly SKIPPED.
- Use this mental profile to give more targeted guidance and avoid past failures, but still leave 20% room for exploration to keep things fresh.

### ANALYSIS RULES:
- Do NOT suggest any event titles that already appear in the user's history or in the ADDITIONAL EXCLUDED EVENT TITLES list.
- Analyze SKIPPED events to identify negative signals.
- Use PINNED events to find adjacent interests or similar venues.
- Balance relevance with how soon the event is upcoming. Again, only suggest events that are taking place on or after ${today}.

### MUSIC RECOMMENDATION & ARTIST IDENTIFICATION:
If the event is a concert, DJ set, live music show, performance, party, club night, or features a clear musical artist / DJ:
- Identify the primary performing musical artist or DJ.
- Set "music_artist" to the clean, plain name of the main performing artist or DJ (e.g. "Dead Prez").
- Set "spotify_artist_id" to null.
- If the event is NOT music-related, set BOTH "spotify_artist_id" and "music_artist" to null.

### OUTPUT FORMAT:
Output as a strict JSON array of objects with these exact keys: 
"id" (unique string), 
"title", 
"description", 
"time" (Format: 'Weekday, Month Day, Year, Time'), 
"search_rationale" (Briefly state the exact website source AND quote the exact date/year mentioned in the search snippet to prove it is upcoming),
"link" (CRITICAL: You MUST output a Google Search URL formatted EXACTLY like this: https://www.google.com/search?q=Event+Name+Venue+NYC+Tickets. Replace spaces with +. Only provide this Google Search link.),
"why" (Provide a brief 1-sentence explanation of why this aligns with their profile),
"spotify_artist_id" (string or null),
"music_artist" (string or null),
"expected_price" (Estimate the ticket price. When you do not know the price, say "$Unknown". If it varies, try to specify a range like "$20-$40". Otherwise, set to "Free" or a specific amount like "$20" based on search snippets or reasonable predictions. Keep it short and clear.),
"neighborhood" (Extract or predict the NYC neighborhood/borough where the venue or event is located, e.g., "East Village", "Williamsburg", "Bushwick", "Astoria", "Manhattan", "Brooklyn". Keep it short, 1-3 words. Set to null if unknown.)
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
    
    const formattedEvents = eventsArray.map((event: any) => ({
      id: event.id || String(Math.random()),
      title: event.title,
      description: event.description,
      time: event.time,
      link: event.link,
      why: event.why,
      searchRationale: event.search_rationale,
      spotifyArtistId: event.spotify_artist_id || null,
      musicArtist: event.music_artist || null,
      expectedPrice: event.expected_price || null,
      neighborhood: event.neighborhood || null,
    }));

    console.log(`Returning ${formattedEvents.length} items from Gemini (Server-side validation bypassed).`);

    return NextResponse.json(formattedEvents);

  } catch (e: any) {
    console.error("Gemini Recommendations failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
