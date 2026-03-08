'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Restaurant {
    id: number;
    slug: string;
    name: string;
}

export default function RestaurantList() {
    const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
    const [slug, setSlug] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    const fetchRestaurants = async () => {
        try {
            const res = await fetch('/api/resy/restaurants');
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            setRestaurants(data);
        } catch (error) {
            toast.error('Could not fetch restaurants.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRestaurants();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!slug) return;
        const toastId = toast.loading(`Adding ${slug}...`);
        try {
            const res = await fetch('/api/resy/restaurants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ slug }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to add restaurant');
            
            toast.success(`Added ${data.name}!`, { id: toastId });
            setRestaurants(prev => [...prev, data]);
            setSlug('');
        } catch (error: any) {
            toast.error(error.message, { id: toastId });
        }
    };

    const handleDelete = async (id: number) => {
        const toastId = toast.loading('Deleting...');
        try {
            const res = await fetch(`/api/resy/restaurants?id=${id}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete');
            toast.success('Deleted!', { id: toastId });
            setRestaurants(prev => prev.filter(r => r.id !== id));
        } catch (error) {
            toast.error('Could not delete restaurant.', { id: toastId });
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Monitored Restaurants</h2>
            <form onSubmit={handleAdd} className="flex gap-2 mb-6">
                <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="Enter restaurant slug (e.g., 'theodora')"
                    className="flex-grow p-2 border rounded-md"
                />
                <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
                    Add
                </button>
            </form>
            {isLoading ? <p>Loading...</p> : (
                <ul className="space-y-2">
                    {restaurants.map(r => (
                        <li key={r.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
                            <div>
                                <p className="font-semibold">{r.name}</p>
                                <p className="text-sm text-gray-500">{r.slug}</p>
                            </div>
                            <button onClick={() => handleDelete(r.id)} className="text-red-500 hover:text-red-700">
                                Delete
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}