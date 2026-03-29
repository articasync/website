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
  const [historyEvents, setHistoryEvents] = useState<Interaction[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{ rating: number; reason: string }>({ rating: 5, reason: "" });
  const [guidance, setGuidance] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [ratingInputs, setRatingInputs] = useState<{ [id: string]: { rating: number; reason: string } }>({});

  useEffect(() => {
    fetchRecommendations("");
    fetchPinned();
    fetchHistory();
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

  const fetchHistory = async () => {
    try {
      const res = await fetch("/api/events/interactions");
      const data = await res.json();
      if (Array.isArray(data)) setHistoryEvents(data);
    } catch {}
  };

  const deleteHistoryItem = async (id: string) => {
    try {
      await fetch(`/api/events/interactions?id=${id}`, { method: "DELETE" });
      toast.success("Deleted from history!");
      fetchHistory();
      fetchPinned(); // Refresh pins if it was pinned
    } catch {
      toast.error("Failed to delete event interaction");
    }
  };

  const handleEditSave = async (id: string) => {
    try {
      await fetch("/api/events/interactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...editFields }),
      });
      toast.success("Updated history record!");
      setEditingId(null);
      fetchHistory();
      fetchPinned(); // Refresh pins too
    } catch {
      toast.error("Failed to update");
    }
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
        fetchPinned(); // refresh pins if it was pinned
      }
      fetchHistory(); // refresh both for live logs updates

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
    <div className="max-w-5xl mx-auto space-y-4 font-sans text-sm text-stone-800">
      {/* Soft Neutral Architectural Header & Guidance */}
      <header className="bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-xl p-4 shadow-sm flex justify-between items-center space-x-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">NYC Discovery</h1>
          <p className="text-xs text-zinc-600">Personalized Events.</p>
        </div>
        
        <div className="flex-1 max-w-lg flex items-center space-x-2">
          <input
            type="text"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Focus on maker workshops / free music..."
            className="flex-1 text-xs px-3 py-1.5 rounded-md bg-white text-zinc-900 placeholder-zinc-400 border border-zinc-200 outline-none focus:ring-2 focus:ring-zinc-300"
          />
          <button
            onClick={saveGuidance}
            disabled={submitting}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-md text-xs disabled:opacity-50 transition-all font-medium h-[28px]"
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
      <section className="bg-zinc-50 rounded-xl shadow-sm border border-zinc-200 p-4 space-y-3">
        <h2 className="text-sm font-bold border-b border-zinc-200 pb-1 text-zinc-900">
          Queue
        </h2>

        {loading ? (
          <div className="flex items-center justify-center h-12">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-zinc-800"></div>
          </div>
        ) : (
          <div className="space-y-2">
            {recommendations.map((event) => {
              const input = ratingInputs[event.id] || { rating: 5, reason: "" };
              return (
                <div key={event.id} className="flex items-center space-x-4 p-2 border border-zinc-100 rounded-lg bg-white hover:shadow-sm transition-all text-sm h-[60px]">
                  {/* Event Info (Title & Hover Why & Link) */}
                  <div className="w-1/3 min-w-0 pr-2 cursor-help flex flex-col justify-center" title={event.why ? `Why: ${event.why}` : `View Description: ${event.description}`}>
                    <h3 className="font-bold text-zinc-900 truncate hover:text-zinc-800">{event.title}</h3>
                    <div className="flex items-center space-x-2 text-xs truncate">
                      <p className="text-zinc-500 truncate">{event.time}</p>
                      {event.link && (
                        <a href={event.link} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-900 hover:underline">Link</a>
                      )}
                    </div>
                  </div>

                  {/* Inputs and Actions in a horizontal flex layout */}
                  <div className="flex-1 flex items-center space-x-3">
                    {/* Rating mini number box */}
                    <div className="flex items-center space-x-1">
                      <label className="text-xs font-semibold text-zinc-500">Rate:</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={input.rating}
                        onChange={(e) => setRatingInputs(prev => ({
                          ...prev,
                          [event.id]: { ...input, rating: parseInt(e.target.value) }
                        }))}
                        className="w-10 text-xs px-1 py-1 rounded-md border border-zinc-200 outline-none"
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
                      className="flex-1 min-w-0 text-xs px-2 py-1 rounded-md border border-zinc-200 outline-none"
                    />

                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleRateAndReplace(event.id, true, false)}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-900 text-white font-medium text-xs rounded-md transition-all h-[28px]"
                      >
                        Pin
                      </button>
                      <button
                        onClick={() => handleRateAndReplace(event.id, false, true)}
                        className="px-2 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium text-xs rounded-md transition-all h-[28px]"
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

      {/* Collapsible History Panel */}
      <section className="bg-zinc-50 rounded-xl shadow-sm border border-zinc-200 p-4 space-y-3">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex justify-between items-center text-sm font-bold text-zinc-900 border-b border-zinc-200 pb-1"
        >
          <span>History & Logs ({historyEvents.length})</span>
          <span>{showHistory ? "▲ Collapse" : "▼ Expand"}</span>
        </button>

        {showHistory && (
          <div className="space-y-1">
            {historyEvents.length === 0 ? (
              <p className="text-xs text-zinc-500">No past history recorded.</p>
            ) : (
              historyEvents.map((h) => (
                <div key={h.id} className="flex items-center space-x-3 p-1.5 border border-zinc-100 rounded-md bg-white text-xs h-[52px]">
                  <div className="w-1/3 min-w-0 pr-2 cursor-help truncate" title={h.description}>
                    <h3 className="font-bold text-zinc-900 truncate">{h.title}</h3>
                    <div className="flex items-center space-x-2 text-[10px] truncate">
                      <p className="text-zinc-500 truncate">{h.time}</p>
                      {h.pinned && <span className="text-emerald-700 font-bold">Pinned</span>}
                      {h.skipped && <span className="text-red-700 font-bold">Skipped</span>}
                    </div>
                  </div>

                  <div className="flex-1 flex items-center space-x-2">
                    {editingId === h.id ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          max="10"
                          value={editFields.rating}
                          onChange={(e) => setEditFields(p => ({ ...p, rating: parseInt(e.target.value) }))}
                          className="w-10 text-xs px-1 py-1 rounded-md border border-zinc-200"
                        />
                        <input
                          type="text"
                          value={editFields.reason}
                          onChange={(e) => setEditFields(p => ({ ...p, reason: e.target.value }))}
                          className="flex-1 text-xs px-2 py-1 rounded-md border border-zinc-200"
                        />
                        <button onClick={() => handleEditSave(h.id)} className="px-2 py-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-md">Save</button>
                        <button onClick={() => setEditingId(null)} className="px-2 py-1 bg-gray-200 text-gray-700 rounded-md">X</button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 flex items-center space-x-2">
                          <span className="font-bold">[{h.rating ?? 0}/10]:</span>
                          <span className="truncate text-zinc-600 flex-1">{h.reason || "No reason"}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingId(h.id);
                            setEditFields({ rating: h.rating ?? 5, reason: h.reason || "" });
                          }} 
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-zinc-700 font-medium rounded-md h-[26px]"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => deleteHistoryItem(h.id)} 
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-md h-[26px]"
                        >
                          Del
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
