import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
- CRITICAL: Music concerts and nightlife MUST NOT be the only recommendations. Aim for a balanced, rich mix (e.g., 40% music/shows, 30% art/culture/exhibits, 30% learning/workshops/exploration/pop-ups).
- EXPLORATION: Include at least one or two completely "exploratory" or unique niche events in each recommendation set (e.g., a weird neighborhood walking tour, a specialized craft workshop, a science talk in a bar, or an obscure gallery opening) to keep the recommendations fresh and unexpected.

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

### MUSIC RECOMMENDATION & SPOTIFY LOOKUP:
If the event is a concert, DJ set, live music show, performance, party, club night, or features a clear musical artist / DJ:
- Identify the primary performing musical artist or DJ.
- Use the Google Search tool to search for the artist's Spotify page URL. Formulate a search query like: "[Artist Name] site:open.spotify.com/artist/".
- Locate the 22-character alphanumeric Spotify Artist ID from the search result URL (e.g., in "https://open.spotify.com/artist/4tZ59HO1h3wVx6H4TMotpq", the ID is "4tZ59HO1h3wVx6H4TMotpq").
- Set "spotify_artist_id" to this 22-character ID. Make sure it is exactly the 22-character base62 string, not the full URL.
- Set "music_artist" to the name of the main performing artist or DJ.
- CRITICAL FOR TIMEOUTS: If the event is NOT music-related, or if you cannot find a valid 22-character Spotify Artist ID in a single simple search, immediately set BOTH "spotify_artist_id" and "music_artist" to null. Do NOT make multiple query attempts.

### OUTPUT FORMAT:
Output as a strict JSON array of objects with these exact keys: 
"id" (unique string), 
"title", 
"description", 
"time" (Format: 'Weekday, Month Day, Year, Time'), 
"search_rationale" (Briefly state the exact website source AND quote the exact date/year mentioned in the search snippet to prove it is upcoming),
"link" (CRITICAL: You MUST output a Google Search URL formatted EXACTLY like this: https://www.google.com/search?q=Event+Name+Venue+NYC+Tickets. Replace spaces with +. Only provide this Google Search link.),
"why" (Provide an in-depth explanation of why this aligns with their profile, referencing their pins/skips and explaining why it fits and was selected for them),
"spotify_artist_id" (string or null),
"music_artist" (string or null)
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
    }));

    console.log(`Returning ${formattedEvents.length} items from Gemini (Server-side validation bypassed).`);

    return NextResponse.json(formattedEvents);

  } catch (e: any) {
    console.error("Gemini Recommendations failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
