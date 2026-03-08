'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function Settings() {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await fetch('/api/resy/settings');
                if (!res.ok) throw new Error('Failed to fetch settings');
                const data = await res.json();
                setEmail(data.email || '');
            } catch (error) {
                toast.error('Could not load notification email.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        const toastId = toast.loading('Saving email...');
        try {
            const res = await fetch('/api/resy/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            if (!res.ok) throw new Error('Failed to save email');
            toast.success('Email saved!', { id: toastId });
        } catch (error) {
            toast.error('Could not save email.', { id: toastId });
        }
    };

    if (isLoading) return <p>Loading settings...</p>;

    return (
        <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-2xl font-semibold mb-4">Notification Settings</h2>
            <form onSubmit={handleSave} className="space-y-4">
                <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">Notification Email</label>
                    <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        className="mt-1 block w-full p-2 border rounded-md"
                        required
                    />
                </div>
                <button type="submit" className="w-full bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600">
                    Save Email
                </button>
            </form>
        </div>
    );
}