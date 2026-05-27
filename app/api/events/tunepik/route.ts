import { NextResponse } from "next/server";
import { getOrFetchSpotifyLink } from "@/lib/spotify";
import crypto from "crypto";

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
const GOOGLE_CSE_ID = process.env.GOOGLE_CSE_ID || ""; // Custom Search Engine ID (cx)

// Helper to classify event into ENUM genres based on title/description keywords
function classifyGenre(title: string, description: string): "Techno" | "House" | "Tech-House/Melodic" | "Experimental/Leftfield" | "Disco/Vibe" {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes("techno") || text.includes("industrial") || text.includes("minimal") || text.includes("acid") || text.includes("basement")) {
    return "Techno";
  }
  if (text.includes("tech house") || text.includes("tech-house") || text.includes("melodic") || text.includes("progressive")) {
    return "Tech-House/Melodic";
  }
  if (text.includes("experimental") || text.includes("leftfield") || text.includes("ambient") || text.includes("breaks") || text.includes("garage")) {
    return "Experimental/Leftfield";
  }
  if (text.includes("disco") || text.includes("vocal house") || text.includes("soulful") || text.includes("vibe")) {
    return "Disco/Vibe";
  }
  return "House"; // Default fallback
}

// Helper to extract potential artists from the event title
function extractArtistsFromTitle(title: string): string[] {
  // E.g., "Ben Klock, DVS1 at BASEMENT NYC" -> ["Ben Klock", "DVS1"]
  // Remove "at Venue..." or "in NYC..."
  const cleanedTitle = title.split(/\s+(at|in|with|presents)\s+/i)[0];
  
  // Split by comma, ampersand, "b2b", or "feat"
  const splitPattern = /\s*(?:,|\b&\b|\bfeat\.?\b|\bb2b\b)\s*/gi;
  return cleanedTitle
    .split(splitPattern)
    .map(name => name.trim())
    .filter(name => name.length > 0 && name.toLowerCase() !== "resident advisor");
}

export async function GET(request: Request) {
  try {
    // If Google API keys are missing, return a clean mock/guide response so developers can test
    if (!GOOGLE_API_KEY || !GOOGLE_CSE_ID) {
      console.warn("Missing GOOGLE_API_KEY or GOOGLE_CSE_ID environment variables. Serving guide/mock data.");
      return NextResponse.json({
        error: "Google Custom Search API not configured.",
        message: "To activate real-time whitelisted scraping, please add 'GOOGLE_API_KEY' and 'GOOGLE_CSE_ID' (Custom Search Engine cx ID) to your environment variables.",
        setup_guide: {
          1: "Go to Google Cloud Console and enable 'Custom Search API'. Get an API key.",
          2: "Go to programmablesearchengine.google.com and create a search engine restricted to 'ra.co/events/'. Get the search engine ID (cx).",
          3: "Add 'GOOGLE_API_KEY' and 'GOOGLE_CSE_ID' to your environment variables."
        },
        mock_events: getMockEvents()
      });
    }

    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + 14);

    // Format dates for the query
    const startDateISO = startDate.toISOString().split('T')[0];
    const endDateISO = endDate.toISOString().split('T')[0];

    // Search query strictly targeting Resident Advisor NYC events
    const query = `site:ra.co/events/us/newyork`;

    const searchUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&cx=${GOOGLE_CSE_ID}&num=10`;

    const res = await fetch(searchUrl);
    const searchData = await res.json();

    if (searchData.error) {
      throw new Error(searchData.error.message || "Google Custom Search failed");
    }

    const items = searchData.items || [];

    const aggregatedEvents = await Promise.all(
      items.map(async (item: any) => {
        // Extract structured microdata parsed by Google's indexer (Event Schema)
        const eventSchema = item.pagemap?.event?.[0] || {};
        const metatags = item.pagemap?.metatags?.[0] || {};

        const rawTitle = eventSchema.name || item.title || "Electronic Music Event";
        const link = item.link || eventSchema.url || "";
        const rawDate = eventSchema.startDate || metatags["og:title"] || ""; // Fallback to meta tags
        const dateStr = rawDate ? rawDate.split("T")[0] : new Date().toISOString().split("T")[0];

        // Extract venue from Schema location or metadata
        const venue = eventSchema.location || metatags["twitter:app:name:iphone"] || "NYC Venue";

        const description = item.snippet || eventSchema.description || "";

        // Extract and clean artist lists
        const artistNames = extractArtistsFromTitle(rawTitle);
        const enrichedArtists = await Promise.all(
          artistNames.map(async (name) => {
            const spotifyLink = await getOrFetchSpotifyLink(name);
            return {
              artist_name: name,
              spotify_link: spotifyLink,
            };
          })
        );

        const genre = classifyGenre(rawTitle, description);

        // Unique Hash based on title + date + venue
        const hashInput = `${venue}-${dateStr}-${rawTitle}`;
        const eventId = crypto.createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

        return {
          event_id: eventId,
          event_name: rawTitle.replace(/\s*\|\s*Resident\s*Advisor/gi, "").trim(),
          link_to_event: link,
          artists: enrichedArtists,
          date: dateStr,
          venue_name: venue.replace(/\s*at\s*/gi, "").trim(),
          computed_genre_category: genre,
        };
      })
    );

    // Filter events to only show those in the next 2 weeks
    const finalEvents = aggregatedEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate >= startDate && eventDate <= endDate;
    });

    return NextResponse.json(finalEvents.length > 0 ? finalEvents : aggregatedEvents);
  } catch (e: any) {
    console.error("Tunepik Google Search aggregation failed:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

function getMockEvents() {
  return [
    {
      event_id: "mock_silobk_1",
      event_name: "BASEMENT NYC with DVS1",
      link_to_event: "https://ra.co/events/1892734",
      artists: [
        { artist_name: "DVS1", spotify_link: "https://open.spotify.com/artist/752bL3m6gW6V9wO7p7Gj6T" },
        { artist_name: "Aurora Halal", spotify_link: "https://open.spotify.com/artist/5oA4pX3g7z6V9wO7p7Gj6T" }
      ],
      date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      venue_name: "BASEMENT",
      computed_genre_category: "Techno"
    },
    {
      event_id: "mock_silobk_2",
      event_name: "SILO presents: House Collective",
      link_to_event: "https://ra.co/events/1892735",
      artists: [
        { artist_name: "Mark Farina", spotify_link: "https://open.spotify.com/artist/5m4rKF21F3g7z6V9wO7p7Gj" },
        { artist_name: "Colette", spotify_link: null }
      ],
      date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      venue_name: "SILO Brooklyn",
      computed_genre_category: "House"
    }
  ];
}
