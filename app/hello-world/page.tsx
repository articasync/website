import Link from "next/link";

export default function HelloWorldPage() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Hello World!</h1>
      <p className="text-lg text-gray-600 mb-8">
        This is a new tab. Hello, World!
      </p>
      <Link href="/" className="text-blue-500 hover:text-blue-700 underline">
        Go back home
      </Link>
    </div>
  );
}
