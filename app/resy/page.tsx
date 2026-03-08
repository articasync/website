import RestaurantList from "@/components/resy/RestaurantList";
import Settings from "@/components/resy/Settings";
import { Suspense } from "react";

export default function ResyPage() {
    return (
        <div>
            <header className="mb-12 border-b pb-4">
                <h1 className="text-4xl font-bold tracking-tight">Resy Reservation Finder</h1>
                <p className="text-gray-500 mt-2">
                    Add restaurant slugs to monitor for available tables. The scraper runs automatically every 5 minutes.
                </p>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2">
                    <Suspense fallback={<p>Loading restaurants...</p>}>
                        <RestaurantList />
                    </Suspense>
                </div>
                <div>
                    <Suspense fallback={<p>Loading settings...</p>}>
                        <Settings />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}