import Link from "next/link";

export default function HomePage() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Welcome to My Website</h1>
      <p className="text-lg text-gray-600 mb-8">
        This is the homepage. The cool stuff is on the Resy page.
      </p>
      <Link href="/resy" className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
          Go to Resy Scraper
      </Link>
    </div>
  );
}