'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Alert {
    id: string;
    slug: string;
    name: string;
    email: string;
    lastCheckedAt?: string;
    lastCheckStatus?: string;
    lastNotifiedAt?: string;
    lastNotifiedSlotDate?: string;
    lastEmailStatus?: string;
}

function timeSince(dateString?: string | null) {
    if (!dateString) return 'never';
    const date = new Date(dateString);
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    let interval = seconds / 31536000;
    if (interval >= 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval >= 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval >= 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval >= 1) return Math.floor(interval) + " hours ago";
    interval = seconds / 60;
    if (interval >= 1) return Math.floor(interval) + " minutes ago";

    if (seconds < 10) return "just now";
    return Math.floor(seconds) + " seconds ago";
}

export default function RestaurantList() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [slug, setSlug] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchAlerts = async () => {
        try {
            const res = await fetch('/api/resy/restaurants');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setAlerts(data);
        } catch (error) {
            toast.error('Could not fetch alerts.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!slug || !email) return;
        const toastId = toast.loading(`Adding alert for ${slug}...`);
        try {
            const res = await fetch('/api/resy/restaurants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug, email }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (data.resyUrl) {
                    toast.error(
                        <span>
                            {data.error} <br />
                            <a href={data.resyUrl} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 font-medium hover:text-blue-800">
                                Book directly here
                            </a>
                        </span>,
                        { id: toastId, duration: 8000 }
                    );
                    return;
                }
                throw new Error(data.error || 'Failed to add alert');
            }
            
            toast.success(`Added ${data.name} for ${email}!`, { id: toastId });
            setAlerts(prev => [data, ...prev]);
            setSlug('');
            setEmail('');
        } catch (error: any) {
            toast.error(error.message, { id: toastId });
        }
    };

    const handleDelete = async (id: string) => {
        const toastId = toast.loading('Deleting...');
        try {
            const res = await fetch(`/api/resy/restaurants?id=${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete');
            toast.success('Deleted!', { id: toastId });
            setAlerts(prev => prev.filter(a => a.id !== id));
        } catch (error) {
            toast.error('Could not delete alert.', { id: toastId });
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Monitored Restaurants</h2>
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2 mb-6">
                <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="Resy Slug (e.g., 'theodora')"
                    className="flex-grow p-2 border rounded-md"
                />
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email Address"
                    className="flex-grow p-2 border rounded-md"
                />
                <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600">
                    Add
                </button>
            </form>
            {isLoading ? <p>Loading...</p> : (
                <ul className="space-y-3">
                    {alerts.map(a => (
                        <li key={a.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-white rounded-xl border border-gray-100 shadow-sm gap-4 transition-all hover:shadow-md hover:border-gray-200">
                            <div className="flex flex-col gap-1.5 w-full">
                                <div className="flex items-center gap-3">
                                    <p className="font-bold text-gray-900 text-lg tracking-tight">{a.name} <span className="font-normal text-gray-400 text-sm ml-1">({a.slug})</span></p>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span>{a.email}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span className="flex items-center gap-2">
                                        {a.lastCheckedAt ? `Last checked ${timeSince(a.lastCheckedAt)}` : 'Waiting for first scan...'}
                                        {a.lastCheckStatus?.startsWith('200') ? (
                                            <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] uppercase font-semibold text-green-700 ring-1 ring-inset ring-green-600/20">
                                                OK (200)
                                            </span>
                                        ) : a.lastCheckStatus ? (
                                            <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[10px] uppercase font-semibold text-red-700 ring-1 ring-inset ring-red-600/10">
                                                {a.lastCheckStatus}
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] uppercase font-semibold text-yellow-800 ring-1 ring-inset ring-yellow-600/20">
                                                Pending
                                            </span>
                                        )}
                                    </span>
                                </div>
                                {a.lastNotifiedAt && a.lastEmailStatus !== 'failed' && a.lastNotifiedSlotDate && (
                                    <div className="flex items-center gap-2 text-xs text-green-600 mt-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                        <span>
                                            {`Sent ${timeSince(a.lastNotifiedAt)} for ${new Date(a.lastNotifiedSlotDate).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }).replace(',', '')}`}
                                        </span>
                                    </div>
                                )}
                                {a.lastNotifiedAt && a.lastEmailStatus === 'failed' && (
                                    <div className="flex items-center gap-2 text-xs text-red-600 mt-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span>
                                            {`Failed to send email ${timeSince(a.lastNotifiedAt)}`}
                                        </span>
                                    </div>
                                )}
                                {!a.lastNotifiedAt && (
                                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                        </svg>
                                        <span>No emails sent yet</span>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => handleDelete(a.id)} className="text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap text-sm border border-red-100 sm:self-center self-end">
                                Delete
                            </button>
                        </li>
                    ))}
                    {alerts.length === 0 && <p className="text-gray-500 text-sm italic">No alerts configured yet.</p>}
                </ul>
            )}
        </div>
    );
}