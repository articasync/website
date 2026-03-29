"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface EventRecommendation {
  id: string;
  title: string;
  description: string;
  why?: string;
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
    fetchRecommendations("");
  }, []);

  const fetchRecommendations = async (currentGuidance: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/recommendations?guidance=${encodeURIComponent(currentGuidance)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecommendations(data);
        
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

  const saveGuidance = () => {
    // Only apply in current generation (no DB write)
    fetchRecommendations(guidance);
    toast.success("Applied guidance to current generation!");
  };

  const handleRateAndReplace = async (eventId: string, isPin: boolean = false, isSkip: boolean = false) => {
    const input = ratingInputs[eventId] || { rating: 5, reason: "" };
    const event = recommendations.find(e => e.id === eventId);
    if (!event) return;

    try {
      // Save interaction (both pin and skip save selections)
      await fetch("/api/events/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          description: event.description,
          time: event.time,
          link: event.link,
          rating: input.rating,
          reason: input.reason,
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
    <div className="max-w-5xl mx-auto space-y-3 font-sans text-xs">
      {/* Super Compact Header & Guidance in One Row */}
      <header className="bg-slate-900 text-white rounded-xl p-3 shadow-md flex justify-between items-center space-x-4">
        <div>
          <h1 className="text-lg font-bold tracking-tight">NYC Discovery</h1>
          <p className="text-xs text-white/70">Personalized Events.</p>
        </div>
        
        <div className="flex-1 max-w-lg flex items-center space-x-2">
          <input
            type="text"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Focus on maker workshops / free music..."
            className="flex-1 text-xs px-2 py-1.5 rounded-md bg-white/10 text-white placeholder-white/40 border border-white/20 outline-none focus:bg-white/20"
          />
          <button
            onClick={saveGuidance}
            disabled={submitting}
            className="px-3 py-1.5 bg-white text-slate-900 font-semibold rounded-md text-xs hover:bg-gray-100 disabled:opacity-50 transition-all font-medium h-[28px]"
          >
            Apply
          </button>
        </div>
      </header>

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
              <div key={event.id} className="bg-white rounded-md p-2 shadow-sm border border-gray-100 relative group transition-all flex flex-col justify-between h-[100px]">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 truncate" title={event.description}>{event.title}</h3>
                  <p className="text-slate-500 text-[10px] font-medium truncate">{event.time}</p>
                </div>
                {event.link && (
                  <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-800 hover:underline inline-block font-medium">Link</a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Dynamic Recommendation Queue */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 space-y-2">
        <h2 className="text-sm font-bold border-b pb-1 flex items-center space-x-1">
          <span>🎯 Queue</span>
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-12">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-slate-800"></div>
          </div>
        ) : (
          <div className="space-y-1">
            {recommendations.map((event) => {
              const input = ratingInputs[event.id] || { rating: 5, reason: "" };
              return (
                <div key={event.id} className="flex items-center space-x-3 p-1.5 border border-gray-100 rounded-lg hover:shadow-sm transition-all text-xs h-[52px]">
                  {/* Event Info (Title & Hover Why) */}
                  <div className="w-1/3 min-w-0 pr-2 cursor-help" title={event.why ? `🤖 Why Gemini: ${event.why}` : `ℹ️ View Description: ${event.description}`}>
                    <h3 className="font-bold text-gray-900 truncate hover:text-slate-800">{event.title}</h3>
                    <p className="text-slate-500 text-[10px] truncate">{event.time}</p>
                  </div>

                  {/* Inputs and Actions in a horizontal flex layout */}
                  <div className="flex-1 flex items-center space-x-2">
                    {/* Rating mini number box */}
                    <div className="flex items-center space-x-1">
                      <label className="text-[10px] font-semibold text-gray-500">Rate:</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={input.rating}
                        onChange={(e) => setRatingInputs(prev => ({
                          ...prev,
                          [event.id]: { ...input, rating: parseInt(e.target.value) }
                        }))}
                        className="w-10 text-xs px-1 py-1 rounded-md border border-gray-200 outline-none"
                      />
                    </div>

                    <input
                      type="text"
                      placeholder="Reason..."
                      value={input.reason}
                      onChange={(e) => setRatingInputs(prev => ({
                        ...prev,
                        [event.id]: { ...input, reason: e.target.value }
                      }))}
                      className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md border border-gray-200 outline-none"
                    />

                    {event.link && (
                      <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-slate-800 hover:underline">Link</a>
                    )}

                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleRateAndReplace(event.id, true, false)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-900 text-white font-medium text-[10px] rounded-md transition-all h-[26px]"
                      >
                        Pin
                      </button>
                      <button
                        onClick={() => handleRateAndReplace(event.id, false, true)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-[10px] rounded-md transition-all h-[26px]"
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
