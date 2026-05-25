"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface Artist {
  artist_name: string;
  spotify_link: string | null;
}

interface TunepikEvent {
  event_id: string;
  event_name: string;
  link_to_event: string;
  artists: Artist[];
  date: string;
  venue_name: string;
  computed_genre_category: "Techno" | "House" | "Tech-House/Melodic" | "Experimental/Leftfield" | "Disco/Vibe";
}

const SpotifyIcon = () => (
  <svg
    className="w-4 h-4 fill-current"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 0C5.373 0 0 5.372 0 12s5.373 12 12 12 12-5.372 12-12S18.627 0 12 0zm5.488 17.302c-.216.354-.68.468-1.033.252-2.862-1.748-6.463-2.146-10.704-1.177-.404.092-.814-.162-.907-.566-.092-.404.162-.814.566-.907 4.637-1.06 8.604-.6 11.826 1.367.353.216.467.68.252 1.031zm1.464-3.26c-.272.443-.855.584-1.298.312-3.275-2.013-8.267-2.597-12.137-1.422-.497.15-1.022-.13-1.173-.627-.151-.497.13-1.022.627-1.173 4.425-1.344 9.924-.69 13.67 1.615.442.272.583.855.311 1.295zm.126-3.41c-3.928-2.333-10.414-2.548-14.184-1.404-.603.183-1.246-.157-1.428-.76-.183-.603.157-1.246.76-1.428 4.336-1.316 11.492-1.066 16.007 1.613.542.322.72.1.397.64-.323.543-.398.72-.64.398z" />
  </svg>
);

const GenreColors: Record<string, { bg: string; text: string; border: string }> = {
  Techno: { bg: "bg-purple-950/40", text: "text-purple-400", border: "border-purple-900/60" },
  House: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-900/60" },
  "Tech-House/Melodic": { bg: "bg-sky-950/40", text: "text-sky-400", border: "border-sky-900/60" },
  "Experimental/Leftfield": { bg: "bg-emerald-950/40", text: "text-emerald-400", border: "border-emerald-900/60" },
  "Disco/Vibe": { bg: "bg-rose-950/40", text: "text-rose-400", border: "border-rose-900/60" },
};

export default function TunepikPage() {
  const [events, setEvents] = useState<TunepikEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedGenre, setSelectedGenre] = useState<string>("All");
  const [selectedVenue, setSelectedVenue] = useState<string>("All");

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/tunepik?t=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        toast.error(data.error || "Failed to retrieve NYC electronic music listings.");
      }
    } catch (e) {
      toast.error("Network error trying to aggregate events.");
    } finally {
      setLoading(false);
    }
  };

  // Extract list of unique venues for filtering
  const uniqueVenues = Array.from(
    new Set(events.map((e) => e.venue_name).filter(Boolean))
  ).sort();

  const genres = ["All", "Techno", "House", "Tech-House/Melodic", "Experimental/Leftfield", "Disco/Vibe"];

  const filteredEvents = events.filter((e) => {
    const genreMatch = selectedGenre === "All" || e.computed_genre_category === selectedGenre;
    const venueMatch = selectedVenue === "All" || e.venue_name === selectedVenue;
    return genreMatch && venueMatch;
  });

  // Format date cleanly (e.g. Monday, May 25, 2026)
  const formatDate = (dateString: string) => {
    try {
      const options: Intl.DateTimeFormatOptions = { weekday: "long", month: "short", day: "numeric" };
      const d = new Date(dateString + "T00:00:00");
      return d.toLocaleDateString("en-US", options);
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200 font-sans -m-4 sm:-m-8 p-6 sm:p-10 space-y-8 pb-20 selection:bg-purple-500 selection:text-white">
      
      {/* Header Banner Section */}
      <header className="relative border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl p-8 overflow-hidden shadow-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(168,85,247,0.08),transparent_60%)] pointer-events-none" />
        <div className="relative z-10 space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-purple-400 bg-purple-950/60 rounded-full border border-purple-800/40 uppercase animate-pulse">
              Real-time Aggregator
            </span>
            <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-400 bg-emerald-950/60 rounded-full border border-emerald-800/40 uppercase">
              NYC Electronic
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-zinc-100 via-purple-200 to-zinc-100">
            Tunepik
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Aggregated electronic music lineups across NYC with real-time Spotify profile discovery and strict genre classifications.
          </p>
        </div>

        <button
          onClick={fetchEvents}
          disabled={loading}
          className="relative z-10 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl transition-all flex items-center gap-2 border border-purple-500 shadow-lg shadow-purple-950/30 hover:scale-[1.02] active:scale-[0.98]"
        >
          <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17" />
          </svg>
          <span>Sync Aggregator</span>
        </button>
      </header>

      {/* Filters Shelf */}
      <section className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-5 backdrop-blur-sm">
        
        {/* Genre Capsules list */}
        <div className="space-y-2">
          <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold">Filter Genre</span>
          <div className="flex flex-wrap gap-2">
            {genres.map((genre) => (
              <button
                key={genre}
                onClick={() => setSelectedGenre(genre)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                  selectedGenre === genre
                    ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-950/50"
                    : "bg-zinc-950/80 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200"
                }`}
              >
                {genre}
              </button>
            ))}
          </div>
        </div>

        {/* Venue select dropdown */}
        <div className="space-y-2 w-full lg:w-auto">
          <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-bold block">Select Venue</span>
          <select
            value={selectedVenue}
            onChange={(e) => setSelectedVenue(e.target.value)}
            className="w-full lg:w-[220px] px-3 py-2 bg-zinc-950 text-xs text-zinc-300 rounded-lg border border-zinc-800 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
          >
            <option value="All">All Venues</option>
            {uniqueVenues.map((venue) => (
              <option key={venue} value={venue}>
                {venue}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Events Grid / Loading States */}
      <main className="space-y-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-zinc-800" />
              <div className="absolute inset-0 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-zinc-500 text-sm font-medium animate-pulse">Querying Resident Advisor & direct NYC venues...</p>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-20 border border-zinc-800/60 rounded-2xl bg-zinc-900/20">
            <p className="text-zinc-400 text-sm">No events found matching your selected criteria.</p>
            <button
              onClick={() => { setSelectedGenre("All"); setSelectedVenue("All"); }}
              className="mt-4 text-xs text-purple-400 hover:underline font-medium"
            >
              Clear active filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredEvents.map((event) => {
              const colors = GenreColors[event.computed_genre_category] || GenreColors["House"];
              return (
                <div
                  key={event.event_id}
                  className="group bg-zinc-900/30 border border-zinc-800 hover:border-zinc-700/80 rounded-xl p-6 flex flex-col justify-between gap-6 transition-all duration-300 hover:shadow-xl hover:shadow-purple-950/5 relative overflow-hidden"
                >
                  {/* Absolute backdrop accent lights */}
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-500/5 to-transparent rounded-bl-full pointer-events-none" />

                  <div className="space-y-4">
                    {/* Category & Location header line */}
                    <div className="flex justify-between items-start gap-2">
                      <span className={`px-2.5 py-0.5 rounded-md text-[9px] font-bold border uppercase tracking-wide ${colors.bg} ${colors.text} ${colors.border}`}>
                        {event.computed_genre_category}
                      </span>
                      <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-semibold">
                        <span>📍</span>
                        <span className="truncate max-w-[140px]">{event.venue_name}</span>
                      </div>
                    </div>

                    {/* Date & Title */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-purple-400/80 font-bold tracking-wider uppercase">
                        {formatDate(event.date)}
                      </p>
                      <h3 className="font-extrabold text-zinc-100 tracking-tight leading-snug text-base truncate group-hover:text-white" title={event.event_name}>
                        {event.event_name}
                      </h3>
                    </div>

                    {/* Artist tags shelf */}
                    <div className="space-y-2 pt-1">
                      <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold block">Performers</span>
                      <div className="flex flex-wrap gap-2">
                        {event.artists.length === 0 ? (
                          <span className="text-xs text-zinc-600 italic">TBA / Unlisted</span>
                        ) : (
                          event.artists.map((artist, idx) => (
                            <div
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950 border border-zinc-800/80 hover:border-zinc-700 text-xs font-medium transition-colors duration-200"
                            >
                              <span className="text-zinc-300">{artist.artist_name}</span>
                              {artist.spotify_link && (
                                <a
                                  href={artist.spotify_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-emerald-500 hover:text-emerald-400 transition-colors duration-150 p-0.5"
                                  title={`Listen to ${artist.artist_name} on Spotify`}
                                >
                                  <SpotifyIcon />
                                </a>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Action bar */}
                  <div className="border-t border-zinc-800/60 pt-4 flex justify-end">
                    <a
                      href={event.link_to_event}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white font-semibold text-xs rounded-lg border border-zinc-800 hover:border-zinc-700 transition-all text-center flex items-center gap-1.5"
                    >
                      <span>Book Tickets</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
