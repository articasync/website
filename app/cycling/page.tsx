import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cycling Simulator",
  description: "Cycling Simulator",
};

export default function CyclingPage() {
  return (
    <div className="max-w-4xl mx-auto py-4">
      <header className="mb-8 border-b pb-4">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Cycling Simulator</h1>
      </header>
    </div>
  );
}
