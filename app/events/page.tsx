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
  rating?: number;
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
  const [editFields, setEditFields] = useState<{ reason: string }>({ reason: "" });
  const [guidance, setGuidance] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [activeGuidance, setActiveGuidance] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [fetchingMore, setFetchingMore] = useState<boolean>(false);
  const [ratingInputs, setRatingInputs] = useState<{ [id: string]: { reason: string } }>({});

  useEffect(() => {
    const saved = localStorage.getItem("event_recommendations");
    const savedGuidance = localStorage.getItem("active_guidance") || "";
    
    setGuidance(savedGuidance);
    setActiveGuidance(savedGuidance);

    let loadedFromCache = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRecommendations(parsed);
          setLoading(false);
          
          const inputs: any = {};
          parsed.forEach((ev: EventRecommendation) => {
            inputs[ev.id] = { reason: "" };
          });
          setRatingInputs(inputs);
          loadedFromCache = true;
        }
      } catch (e) {}
    }
    
    if (!loadedFromCache) {
      fetchRecommendations(savedGuidance);
    }
    fetchPinned();
    fetchHistory();
  }, []);

  const fetchRecommendations = async (currentGuidance: string, append: boolean = false) => {
    if (append && fetchingMore) return;
    if (append) {
      setFetchingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await fetch(`/api/events/recommendations?guidance=${encodeURIComponent(currentGuidance)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setRecommendations(prev => {
          const updated = append ? [...prev, ...data] : data;
          localStorage.setItem("event_recommendations", JSON.stringify(updated));
          return updated;
        });
        
        const inputs: any = {};
        data.forEach((ev: EventRecommendation) => {
          inputs[ev.id] = { reason: "" };
        });
        setRatingInputs(prev => ({ ...prev, ...inputs }));
      } else {
        toast.error(data.error || "Failed to load events");
      }
    } catch (e) {
      toast.error("Failed to fetch recommendations");
    } finally {
      if (append) {
        setFetchingMore(false);
      } else {
        setLoading(false);
      }
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

  const handleUnpin = async (id: string) => {
    try {
      await fetch("/api/events/interactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, pinned: false }),
      });
      toast.success("Removed from Upcoming!");
      fetchHistory();
      fetchPinned(); // Refresh pins too
    } catch {
      toast.error("Failed to unpin");
    }
  };

  const saveGuidance = () => {
    setActiveGuidance(guidance);
    localStorage.setItem("active_guidance", guidance);
    setRecommendations([]); // Wipe queue
    localStorage.removeItem("event_recommendations");
    fetchRecommendations(guidance, false); // Fetch fresh 10
    toast.success("Applied guidance to current generation!");
  };

  const clearGuidance = () => {
    setGuidance("");
    setActiveGuidance("");
    localStorage.removeItem("active_guidance");
    setRecommendations([]); // Wipe queue
    localStorage.removeItem("event_recommendations");
    fetchRecommendations("", false); // Fetch fresh 10
    toast.success("Cleared guidance focus!");
  };

  const handleRateAndReplace = async (eventId: string, isPin: boolean = false, isSkip: boolean = false) => {
    const input = ratingInputs[eventId] || { reason: "" };
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

      const next = recommendations.filter(e => e.id !== eventId);
      setRecommendations(next);
      localStorage.setItem("event_recommendations", JSON.stringify(next));

      if (next.length === 0) {
        fetchRecommendations(activeGuidance, true); // Append more when queue is empty
      }

    } catch (e) {
      toast.error("An error occurred. Try again.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 font-sans text-sm text-stone-800">
      {/* Soft Neutral Architectural Header & Guidance */}
      <header className="bg-white border border-zinc-200 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">NYC Discovery</h1>
            <p className="text-sm text-zinc-500">Curated cultural events.</p>
          </div>
          
          {activeGuidance && (
            <div className="flex items-center space-x-2 bg-pink-50 border border-pink-100 px-3 py-1.5 rounded-full text-xs font-medium text-pink-700">
              <span>Focus: {activeGuidance}</span>
              <button onClick={clearGuidance} className="hover:text-pink-900 font-bold ml-1">✕</button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2 bg-zinc-50 p-2 rounded-lg border border-zinc-200">
          <svg className="w-5 h-5 text-zinc-400 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="Focus on maker workshops / free music..."
            className="flex-1 bg-transparent text-sm text-zinc-800 placeholder-zinc-400 outline-none"
          />
          <button
            onClick={saveGuidance}
            disabled={submitting}
            className="px-4 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-md text-xs transition-all h-[28px]"
          >
            Apply
          </button>
        </div>
      </header>

      {/* Pinned / Upcoming Events Section */}
      {/* Upcoming Events Section (Always visible) */}
      <section className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-pink-100 rounded-lg text-pink-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold">Upcoming</h2>
        </div>
        
        {pinnedEvents.length === 0 ? (
          <p className="text-xs text-zinc-500 bg-white p-3 rounded-md border border-zinc-200">No events saved here yet. Pin items from the queue!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pinnedEvents.map((event) => (
              <div key={event.id} className="bg-white rounded-md p-2 shadow-sm border border-gray-100 relative group transition-all flex flex-col justify-between h-[100px]">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xs font-bold text-gray-900 truncate" title={event.description}>{event.title}</h3>
                    <button onClick={() => handleUnpin(event.id)} className="text-xs text-red-500 hover:text-red-700 font-bold p-1">X</button>
                  </div>
                  <p className="text-slate-500 text-[10px] font-medium truncate">{event.time}</p>
                </div>
                {event.link && (
                  <a href={event.link} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-800 hover:underline inline-block font-medium">Link</a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

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
                <div key={event.id} className="flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 space-x-0 md:space-x-3 p-2 border border-zinc-100 rounded-lg bg-white hover:shadow-sm transition-all text-sm h-auto md:h-[60px]">
                  <div className="flex items-center space-x-3 w-full md:w-[75%]">
                    {/* Physical Question Mark Target */}
                    <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-md bg-zinc-100 text-zinc-700 font-bold text-xs cursor-help" title={event.why ? `Why: ${event.why}` : `View Description: ${event.description}`}>
                      ?
                    </div>

                    {/* Event Info (Title & Link) - Wider on desktop */}
                    <div className="min-w-0 pr-2 flex flex-col justify-center flex-1 truncate">
                      <h3 className="font-bold text-zinc-900 truncate hover:text-zinc-800 cursor-help" title={event.description}>
                        {event.title}
                      </h3>
                      <div className="flex items-center space-x-2 text-xs truncate">
                        <p className="text-zinc-500 truncate">{event.time}</p>
                        {event.link && (
                          <a href={event.link} target="_blank" rel="noopener noreferrer" className="font-bold text-zinc-900 hover:underline">Link</a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Inputs and Actions in a horizontal flex layout - Shrunk on Desktop, full width on mobile */}
                  <div className="w-full flex md:flex-1 items-center justify-end space-x-1">
                    <input
                      type="text"
                      placeholder="Why pin/skip?"
                      value={ratingInputs[event.id]?.reason || ""}
                      onChange={(e) => setRatingInputs(prev => ({ ...prev, [event.id]: { reason: e.target.value } }))}
                      className="px-2 py-1 text-xs border border-zinc-200 rounded-md outline-none focus:border-zinc-500 w-[120px] h-[28px]"
                    />

                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleRateAndReplace(event.id, true, false)}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-900 text-white font-medium text-xs rounded-md transition-all h-[28px]"
                      >
                        Pin
                      </button>
                      <button
                        onClick={() => handleRateAndReplace(event.id, false, false)}
                        className="px-2 py-1 bg-pink-600 hover:bg-pink-700 text-white font-medium text-xs rounded-md transition-all h-[28px]"
                      >
                        Like
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
                      {!h.pinned && !h.skipped && <span className="text-pink-700 font-bold">Liked</span>}
                    </div>
                  </div>

                  <div className="flex-1 flex justify-end">
                    <button 
                      onClick={() => deleteHistoryItem(h.id)} 
                      className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-medium rounded-md h-[26px]"
                    >
                      Del
                    </button>
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
