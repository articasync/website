import prisma from "./prisma";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

let accessToken = "";
let tokenExpirationTime = 0;

// Strips common promotional noise from artist strings
export function cleanArtistName(name: string): string {
  return name
    .replace(/Supporting Act:/gi, "")
    .replace(/\b(b2b|b\s*2\s*b|hybrid\s+live|dj\s*set|live\s*set|live|opener|closing|headliner)\b/gi, "")
    .replace(/[\(\[].*?[\)\]]/g, "") // Remove parentheses/brackets contents
    .replace(/\s+/g, " ")
    .trim();
}

async function getSpotifyAccessToken(): Promise<string | null> {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.warn("Spotify credentials missing. Using search matching fallback.");
    return null;
  }

  const now = Date.now();
  if (accessToken && now < tokenExpirationTime) {
    return accessToken;
  }

  try {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64")}`,
      },
      body: "grant_type=client_credentials",
    });

    const data = await response.json();
    if (data.access_token) {
      accessToken = data.access_token;
      tokenExpirationTime = now + data.expires_in * 1000 - 60000; // 1 minute safety window
      return accessToken;
    }
  } catch (error) {
    console.error("Failed to retrieve Spotify access token:", error);
  }
  return null;
}

export async function getOrFetchSpotifyLink(rawArtistName: string): Promise<string | null> {
  const cleanedName = cleanArtistName(rawArtistName);
  if (!cleanedName) return null;

  // 1. Check Database Cache first
  try {
    const cached = await prisma.spotifyArtistCache.findUnique({
      where: { artistName: cleanedName },
    });

    if (cached) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      // If cached less than 7 days ago, return cached link
      if (cached.updatedAt > sevenDaysAgo) {
        return cached.spotifyUrl;
      }
    }
  } catch (e) {
    console.error("Cache lookup error:", e);
  }

  // 2. Retrieve Access Token
  const token = await getSpotifyAccessToken();
  let spotifyUrl: string | null = null;

  if (token) {
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?type=artist&q=${encodeURIComponent(cleanedName)}&limit=3`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await response.json();
      const artists = data.artists?.items || [];

      // Match exact text string against the first 3 results (case-insensitive)
      const match = artists.find((item: any) => {
        const name = item.name.toLowerCase().trim();
        const searchName = cleanedName.toLowerCase();
        return name === searchName || name.includes(searchName) || searchName.includes(name);
      });

      if (match && match.external_urls?.spotify) {
        spotifyUrl = match.external_urls.spotify;
      }
    } catch (error) {
      console.error(`Spotify Search failed for artist "${cleanedName}":`, error);
    }
  } else {
    // Mock match or direct Search Link fallback if they successfully matched a known pattern
    // We only do this in fallback/dev mode when Spotify credentials are not active.
    // If they have no credentials, return null as instructed by the default unlisted behavior,
    // or we can construct a direct search link fallback. Let's follow the default spec: return null.
    spotifyUrl = null;
  }

  // 3. Cache the result in the database
  try {
    await prisma.spotifyArtistCache.upsert({
      where: { artistName: cleanedName },
      update: { spotifyUrl, updatedAt: new Date() },
      create: { artistName: cleanedName, spotifyUrl },
    });
  } catch (e) {
    console.error("Cache write error:", e);
  }

  return spotifyUrl;
}
