import RestaurantList from "@/components/resy/RestaurantList";
import { Suspense } from "react";
import Link from "next/link";

export default function ResyPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <header className="mb-12 border-b pb-4 flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight">Resy</h1>
                    <p className="text-gray-500 mt-2 text-lg">
                        Runs every 5 minutes. Notifies at most once for each party of 2 availability within the next week.
                    </p>
                </div>
                <Link href="/fitness" className="text-sm font-medium text-orange-600 hover:text-orange-800 transition">
                    Go to Fitness &rarr;
                </Link>
            </header>
            <div className="w-full">
                <Suspense fallback={<p>Loading alerts...</p>}>
                    <RestaurantList />
                </Suspense>
            </div>
        </div>
    );
}