"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface EventRecommendation {
  id: string;
  title: string;
  description: string;
  time: string;
  link?: string;
}

interface Interaction {
  id: string;
  title: string;
  description: string;
  time: string;
  link?: string;
  rating: number;
  reason: string;
  pinned: boolean;
  skipped: boolean;
}

export default function EventsPage() {
  const [recommendations, setRecommendations] = useState<EventRecommendation[]>([]);
  const [pinnedEvents, setPinnedEvents] = useState<Interaction[]>([]);
  const [guidance, setGuidance] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [ratingInputs, setRatingInputs] = useState<{ [id: string]: { rating: number; reason: string } }>({});

  useEffect(() => {
    fetchRecommendations();
    fetchPinned();
    fetchGuidance();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/events/recommendations");
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecommendations(data);
        
        // Initialize inputs for new recommendations
        const inputs: any = {};
        data.forEach((ev: EventRecommendation) => {
          inputs[ev.id] = { rating: 5, reason: "" };
        });
        setRatingInputs(prev => ({ ...prev, ...inputs }));
      } else {
        toast.error(data.error || "Failed to load events");
      }
    } catch (e) {
      toast.error("Failed to fetch recommendations");
    } finally {
      setLoading(false);
    }
  };

  const fetchPinned = async () => {
    try {
      const res = await fetch("/api/events/interactions?type=pinned");
      const data = await res.json();
      setPinnedEvents(data);
    } catch {}
  };

  const fetchGuidance = async () => {
    try {
      const res = await fetch("/api/events/guidance");
      const data = await res.json();
      setGuidance(data.guidance || "");
    } catch {}
  };

  const saveGuidance = async () => {
    setSubmitting(true);
    try {
      await fetch("/api/events/guidance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guidance }),
      });
      toast.success("Guidance saved!");
      // Re-fetch recommendations with new guidance
      fetchRecommendations();
    } catch (e) {
      toast.error("Failed to save guidance");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRateAndReplace = async (eventId: string, isPin: boolean = false, isSkip: boolean = false) => {
    const input = ratingInputs[eventId] || { rating: 5, reason: "" };
    const event = recommendations.find(e => e.id === eventId);
    if (!event) return;

    try {
      // Save interaction
      await fetch("/api/events/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          description: event.description,
          time: event.time,
          link: event.link,
          rating: isSkip ? null : input.rating,
          reason: isSkip ? "Skipped" : input.reason,
          pinned: isPin,
          skipped: isSkip,
        }),
      });

      toast.success(isSkip ? "Skipped!" : isPin ? "Pinned to upcoming!" : "Rated!");

      if (isPin) {
        fetchPinned(); // refresh pins if pinned
      }

      // Fetch a replacement for this specific event
      const replaceRes = await fetch("/api/events/recommendations?single=true");
      const replaceData = await replaceRes.json();

      setRecommendations(prev => {
        const next = prev.filter(e => e.id !== eventId);
        if (replaceData && replaceData.length > 0) {
          return [...next, replaceData[0]];
        }
        return next;
      });

      if (replaceData && replaceData.length > 0) {
        setRatingInputs(prev => ({
          ...prev,
          [replaceData[0].id]: { rating: 5, reason: "" }
        }));
      }

    } catch (e) {
      toast.error("An error occurred. Try again.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12">
      {/* Dynamic Header with Vibrant Background */}
      <header className="relative bg-slate-900 text-white rounded-3xl p-8 sm:p-12 shadow-xl overflow-hidden">
        <div className="absolute inset-0 bg-white opacity-5 backdrop-blur-3xl"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center space-y-6 md:space-y-0">
          <div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2">NYC Event Discovery</h1>
            <p className="text-lg text-white/80">Curated cultural experiences powered by Gemini AI, driven by your tastes.</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl p-4 flex items-center space-x-4">
            <div className="p-3 bg-white rounded-xl text-slate-900 shadow">
              <span className="text-xl font-bold">5</span>
            </div>
            <div>
              <p className="text-sm font-semibold">Active Recommendations</p>
              <p className="text-xs text-white/60">Regenerates on interaction</p>
            </div>
          </div>
        </div>
      </header>

      {/* General Personalization Guidance Panel */}
      <section className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex items-center space-x-3">
          <div className="p-2 bg-violet-100 rounded-lg text-violet-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
          </div>
          <h2 className="text-xl font-bold">Recommendations Guidance</h2>
        </div>
        <div className="p-6 space-y-4">
          <textarea
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            rows={3}
            placeholder="E.g., 'Focus more on hands-on making workshops and free cheap music events in lower Manhattan. Skip high-ticket venues.'"
            className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-4 focus:ring-violet-200 focus:border-violet-500 transition-all outline-none resize-none font-sans text-gray-700"
          />
          <div className="flex justify-end">
            <button
              onClick={saveGuidance}
              disabled={submitting}
              className="px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl shadow-lg shadow-violet-200 disabled:opacity-50 transition-all transform hover:-translate-y-0.5"
            >
              {submitting ? "Saving..." : "Apply Guidance"}
            </button>
          </div>
        </div>
      </section>

      {/* Pinned / Upcoming Events Section */}
      {pinnedEvents.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-pink-100 rounded-lg text-pink-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold">Upcoming & Pinned</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pinnedEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 relative group transition-all hover:shadow-lg">
                <span className="absolute top-4 right-4 text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded-full">Pinned</span>
                <h3 className="text-lg font-bold mb-1 mt-2 text-gray-900">{event.title}</h3>
                <p className="text-slate-600 text-sm font-medium mb-2">{event.time}</p>
                <p className="text-gray-600 text-sm line-clamp-2">{event.description}</p>
                {event.link && (
                  <a href={event.link} target="_blank" rel="noopener noreferrer" className="mt-2 text-sm text-slate-800 hover:underline inline-block font-medium">View Event Link</a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dynamic Recommendation Queue */}
      <section className="space-y-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-800">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Your Curated Recommendations</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-800"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {recommendations.map((event) => {
              const input = ratingInputs[event.id] || { rating: 5, reason: "" };
              return (
                <div key={event.id} className="bg-white rounded-2xl shadow-md border border-gray-100 flex flex-col justify-between h-[480px] transition-all hover:shadow-lg">
                  <div className="p-6 space-y-4 flex-1">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 group-hover:text-slate-800 transition-colors">{event.title}</h3>
                      <p className="text-slate-600 text-sm font-semibold mt-1">{event.time}</p>
                    </div>
                    <p className="text-gray-600 text-sm overflow-hidden text-ellipsis line-clamp-4">{event.description}</p>
                    {event.link && (
                      <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-sm text-slate-800 hover:underline font-medium inline-block">Visit Event Page</a>
                    )}
                  </div>

                  <div className="border-t border-gray-100 bg-gray-50/50 p-6 rounded-b-2xl space-y-4">
                    {/* Interaction Inputs */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-xs font-semibold text-gray-500">Interest Rating ({input.rating})</label>
                        <span className="text-sm font-bold text-slate-800">{input.rating}/10</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        value={input.rating}
                        onChange={(e) => setRatingInputs(prev => ({
                          ...prev,
                          [event.id]: { ...input, rating: parseInt(e.target.value) }
                        }))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Why this rating? (e.g., Love maker fairs, too expensive)"
                      value={input.reason}
                      onChange={(e) => setRatingInputs(prev => ({
                        ...prev,
                        [event.id]: { ...input, reason: e.target.value }
                      }))}
                      className="w-full text-sm px-3 py-2 rounded-lg border border-gray-200 focus:ring-4 focus:ring-slate-100 focus:border-slate-800 outline-none transition-all font-sans"
                    />

                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleRateAndReplace(event.id, false, false)}
                        className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl transition-all shadow-md"
                      >
                        Rate
                      </button>
                      <button
                        onClick={() => handleRateAndReplace(event.id, true, false)}
                        className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm rounded-xl transition-all shadow-md"
                      >
                        Pin
                      </button>
                      <button
                        onClick={() => handleRateAndReplace(event.id, false, true)}
                        className="px-4 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm rounded-xl transition-all"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
