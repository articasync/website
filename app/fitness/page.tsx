import prisma from "@/lib/prisma";
import Link from "next/link";

export const revalidate = 0; // Don't cache the page, always hit DB

export default async function FitnessDashboard() {
  const latestLog = await prisma.fitnessLog.findFirst({
    orderBy: { date: 'desc' }
  });

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <header className="mb-12 border-b pb-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Daily Fitness</h1>
          <p className="text-gray-500 mt-2 text-lg">
            Garmin morning metrics and Gemini coaching insights based on Strava data.
          </p>
        </div>
      </header>

      {!latestLog ? (
        <div className="text-center py-12 p-8 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-gray-500 font-medium">No fitness data generated yet today.</p>
          <p className="text-gray-400 text-sm mt-2">The cron job runs automatically every morning.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* GARMIN SECTION */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
              <span className="w-2 h-8 bg-blue-500 rounded-full inline-block"></span>
              Garmin Morning Report
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <MetricCard
                label="Resting Heart Rate"
                value={latestLog.rhr ? `${latestLog.rhr} bpm` : "--"}
                color="blue"
              />
              <MetricCard
                label="Heart Rate Variability"
                value={latestLog.hrv ? `${latestLog.hrv} ms` : "--"}
                color="indigo"
              />
              <MetricCard
                label="Sleep Score"
                value={latestLog.sleepScore ? `${latestLog.sleepScore} (${latestLog.sleepHours || 0} hrs)` : "--"}
                color="purple"
              />
              <MetricCard
                label="Training Readiness"
                value={latestLog.trainingReadiness ? `${latestLog.trainingReadiness} / 100` : "--"}
                color="emerald"
              />
              <MetricCard
                label="Menstrual Cycle"
                value={latestLog.menstrualCyclePhase || "N/A"}
                color="rose"
              />
            </div>
          </section>

          {/* AI COACHING SECTION */}
          <section>
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2 mt-12">
              <span className="w-2 h-8 bg-orange-500 rounded-full inline-block"></span>
              AI Coaching Dashboard
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Predicted FTP</p>
                  <p className="text-3xl font-bold text-gray-900">{latestLog.predictedFtp || "--"} W</p>
                </div>
                {latestLog.predictedFtpTrend && (
                  <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                    {latestLog.predictedFtpTrend}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-1">Predicted VO2 Max</p>
                  <p className="text-3xl font-bold text-gray-900">{latestLog.predictedVo2 || "--"}</p>
                </div>
                {latestLog.predictedVo2Trend && (
                  <div className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                    {latestLog.predictedVo2Trend}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 md:p-8 rounded-3xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg relative overflow-hidden">
              {/* decorative bg circle */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>

              <p className="text-orange-100 text-sm font-semibold uppercase tracking-widest mb-2 relative z-10">Today's Adjusted FTP</p>
              <p className="text-6xl font-black mb-6 relative z-10 tracking-tight">{latestLog.ftpToday || "--"} <span className="text-2xl font-medium text-orange-200">W</span></p>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-5 border border-white/20 relative z-10">
                <p className="text-white font-medium mb-1 flex items-center gap-2">
                  <svg className="w-5 h-5 text-orange-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                  Ideal Workout Today
                </p>
                <p className="text-orange-50 text-lg leading-relaxed">{latestLog.idealWorkout || "Rest day recommended based on lack of data."}</p>
              </div>
            </div>

          </section>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string, value: string | number, color: string }) {
  // Simple color mapping for Tailwind bg since template literals for classes aren't always safe with purging
  const bgColors: Record<string, string> = {
    blue: "bg-blue-50 text-blue-700 border-blue-100",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-100",
    purple: "bg-purple-50 text-purple-700 border-purple-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100"
  };

  const selectedTheme = bgColors[color] || bgColors.blue;

  return (
    <div className={`p-5 rounded-2xl border flex flex-col justify-center ${selectedTheme}`}>
      <p className="text-xs font-bold uppercase tracking-widest opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
