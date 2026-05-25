import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { getOrFetchSpotifyLink } from "@/lib/spotify";
import crypto from "crypto";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const ai = new GoogleGenAI({});

export async function GET(request: Request) {
  try {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 14);

    const startDateStr = startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const endDateStr = endDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const systemInstruction = `Return ONLY a valid JSON array. Do not include any introductory text, conversational filler, or Markdown code blocks (like \`\`\`json). Start the response with [ and end it with ].`;

    const prompt = `You are an expert NYC Electronic Music Event Aggregator. 
Find and scrape upcoming electronic music events in New York City from Resident Advisor (ra.co/events/us/newyorkcity) taking place between ${startDateStr} and ${endDateStr} (the next 2 weeks from today).

CRITICAL: You MUST use the Google Search tool to find REAL, upcoming events. Focus strictly on events listed on ra.co/events/us/newyorkcity (Resident Advisor NYC) in this 2-week window, classifying them strictly under: [Techno, Deep House, Tech-House, House, Minimal, Acid, Leftfield/Experimental Electronic, Industrial, Disco, Breaks/Garage].

### TARGET DOMAIN TO SCRAPE:
- Website: ra.co/events/us/newyorkcity
- Do not rely on training data for dates, venues, or lineups. Pull live listings for the specified 2-week range.

### DIVERSITY & NORMALIZATION RULES:
- Generate up to 15 real, upcoming events from Resident Advisor.
- Extract direct ticket or primary listing URLs (NEVER output a homepage like "ra.co" or "ra.co/events/us/newyorkcity").
- Identify all performing artists for each event.
- Classify each event into one of these exact computed_genre_category ENUMs:
  - "Techno" (Industrial, Techno, Hard Techno, Acid, Minimal)
  - "House" (House, Deep House, Breaks/Garage)
  - "Tech-House/Melodic" (Tech-House, Progressive)
  - "Experimental/Leftfield" (Leftfield, Ambient, Experimental)
  - "Disco/Vibe" (Disco, Nu-Disco, Vocal House)

### OUTPUT FORMAT:
Output a strict JSON array of objects with these exact keys:
- "event_name" (string)
- "link_to_event" (string: CRITICAL: output direct event page URL extracted from search, or a Google Search ticket link: https://www.google.com/search?q=Event+Name+Tickets)
- "artists" (array of strings: names of performing artists/DJs)
- "date" (string in YYYY-MM-DD format)
- "venue_name" (string: name of the NYC venue, e.g. "BASEMENT")
- "computed_genre_category" (string: "Techno", "House", "Tech-House/Melodic", "Experimental/Leftfield", or "Disco/Vibe")
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
        tools: [
          {
            googleSearch: {}
          }
        ]
      }
    });

    let text = response.text || "";
    if (typeof text === "string") {
      if (text.startsWith('```json')) {
        text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
      } else if (text.startsWith('```')) {
        text = text.replace(/^```\n/, '').replace(/\n```$/, '');
      }
      text = text.trim();
    } else {
      text = JSON.stringify(text);
    }

    let eventsArray: any[] = [];
    try {
      eventsArray = JSON.parse(text);
    } catch (e) {
      console.error("Failed to parse Tunepik raw JSON output:", text);
    }

    if (!Array.isArray(eventsArray)) {
      eventsArray = [];
    }

    // Enrich each artist in each event using our Spotify API & Cache Pipeline
    const enrichedEvents = await Promise.all(
      eventsArray.map(async (event: any) => {
        const rawArtists = Array.isArray(event.artists) ? event.artists : [];
        const enrichedArtists = await Promise.all(
          rawArtists.map(async (name: string) => {
            const spotifyLink = await getOrFetchSpotifyLink(name);
            return {
              artist_name: name,
              spotify_link: spotifyLink,
            };
          })
        );

        const venue = event.venue_name || "Unknown Venue";
        const date = event.date || new Date().toISOString().split("T")[0];
        const name = event.event_name || "Electronic Music Event";

        // Hash event venue + date + name to get a unique event_id
        const hashInput = `${venue}-${date}-${name}`;
        const eventId = crypto.createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

        return {
          event_id: eventId,
          event_name: name,
          link_to_event: event.link_to_event || `https://www.google.com/search?q=${encodeURIComponent(name + " NYC Tickets")}`,
          artists: enrichedArtists,
          date: date,
          venue_name: venue,
          computed_genre_category: event.computed_genre_category || "House",
        };
      })
    );

    return NextResponse.json(enrichedEvents);
  } catch (e: any) {
    console.error("Tunepik events compilation failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
