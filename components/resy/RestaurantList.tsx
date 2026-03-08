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
}

function timeSince(dateString: string) {
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
            if (!res.ok) throw new Error(data.error || 'Failed to add alert');
            
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
                        <li key={a.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md border text-sm sm:text-base">
                            <div>
                                <p className="font-semibold text-gray-900">{a.name} <span className="font-normal text-gray-500 text-xs ml-1">({a.slug})</span></p>
                                <p className="text-sm text-blue-600 mt-0.5">{a.email}</p>
                                {a.lastCheckedAt && (
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        <div className={`w-2 h-2 rounded-full ${a.lastCheckStatus?.startsWith('200') ? 'bg-green-500' : 'bg-red-500'}`} />
                                        <span className="text-xs text-gray-500">
                                            {a.lastCheckStatus?.startsWith('200') ? 'OK' : a.lastCheckStatus} - {timeSince(a.lastCheckedAt)}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => handleDelete(a.id)} className="text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
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