import type { Metadata } from "next";
import SimulatorClient from "@/components/SimulatorClient";

export const metadata: Metadata = {
  title: "Cycling Simulator",
  description: "Human cycling bioenergetics and physiology physics simulator",
};

export default function CyclingPage() {
  return (
    <div className="min-h-screen">
      <SimulatorClient />
    </div>
  );
}
