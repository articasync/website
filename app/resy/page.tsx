import RestaurantList from "@/components/resy/RestaurantList";
import { Suspense } from "react";


export default function ResyPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <header className="mb-12 border-b pb-4">
                <h1 className="text-4xl font-bold tracking-tight">Resy</h1>
                <p className="text-gray-500 mt-2 text-lg">
                    Runs every 5 minutes. Notifies at most once for each party of 2 availability within the next week.
                </p>
            </header>
            <div className="w-full">
                <Suspense fallback={<p>Loading alerts...</p>}>
                    <RestaurantList />
                </Suspense>
            </div>
        </div>
    );
}