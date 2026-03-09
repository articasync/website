import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { GarminConnect } from "garmin-connect";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const maxDuration = 300; // Allow enough time for APIs
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // 1. AUTHENTICATE THE CRON JOB
  const authHeader = request.headers.get("Authorization");
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  if (process.env.NODE_ENV === "production" && (!authHeader || authHeader !== expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Format dates for Garmin (YYYY-MM-DD)
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    // ==========================================
    // 2. FETCH GARMIN DATA
    // ==========================================
    console.log("Fetching Garmin Data...");
    if (!process.env.GARMIN_USERNAME || !process.env.GARMIN_PASSWORD) {
        throw new Error("Missing GARMIN_USERNAME or GARMIN_PASSWORD");
    }
    const garminClient = new GarminConnect({
        username: process.env.GARMIN_USERNAME,
        password: process.env.GARMIN_PASSWORD
    });
    
    await garminClient.login();
    const sleepData = await garminClient.getSleepData(today).catch(() => null);
    
    // We can pull general summaries if the user gives us endpoints, 
    // but the get methods let us hit any Garmin Connect API.
    const hrData = await garminClient.getHeartRate(today).catch(() => null);

    const garminRaw = {
        sleep: sleepData,
        heartRate: hrData
        // If we knew the specific endpoint for menstrual phase, we could add here.
    };

    // ==========================================
    // 3. FETCH STRAVA DATA
    // ==========================================
    console.log("Fetching Strava Data...");
    if (!process.env.STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET || !process.env.STRAVA_REFRESH_TOKEN) {
        throw new Error("Missing Strava env vars");
    }

    // Refresh the access token
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            client_id: process.env.STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            refresh_token: process.env.STRAVA_REFRESH_TOKEN,
            grant_type: "refresh_token"
        })
    });
    
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
        throw new Error(`Strava auth failed: ${JSON.stringify(tokenData)}`);
    }

    const stravaAccessToken = tokenData.access_token;
    
    // Get yesterday's activities from Strava
    const yesterdayEpoch = Math.floor(yesterday.setHours(0,0,0,0) / 1000);
    const todayEpoch = Math.floor(today.setHours(0,0,0,0) / 1000);
    
    const activitiesRes = await fetch(`https://www.strava.com/api/v3/athlete/activities?after=${yesterdayEpoch}&before=${todayEpoch}`, {
        headers: {
            "Authorization": `Bearer ${stravaAccessToken}`
        }
    });

    const stravaData = await activitiesRes.json();

    // ==========================================
    // 4. CALL GEMINI TO PARSE AND PREDICT
    // ==========================================
    console.log("Processing with Gemini...");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    const prompt = `
    You are an elite cycling coach. Assess this raw Garmin and Strava data and return ONLY a JSON block, nothing else.
    Try to infer the required Garmin stats from the dump (if present, like RHR or HRV or Sleep from sleep data/hr data).
    If a metric like menstrual phase is genuinely not found, return null.
    
    Garmin Data (Today):
    ${JSON.stringify(garminRaw).substring(0, 4000)}
    
    Strava Data (Yesterday):
    ${JSON.stringify(stravaData)}
    
    Extract these garmin stats specifically (can be approximations based on data where reasonable):
    - rhr (number)
    - hrv (number)
    - sleepScore (0-100 number)
    - sleepHours (number)
    - trainingReadiness (0-100 number)
    - menstrualCyclePhase (string or null)

    Then generate:
    - predictedFtp (your best estimated FTP for this rider, number)
    - predictedFtpTrend (string, e.g., "Trending Up", "Stable")
    - predictedVo2 (number, VO2 Max estimate)
    - predictedVo2Trend (string)
    - ftpToday (number, adjusted based on today's fatigue)
    - idealWorkout (string, 1-3 sentences suggesting what to do today)

    Return STRICTLY JSON. Example:
    {
      "garmin": {
        "rhr": 45, "hrv": 60, "sleepScore": 85, "sleepHours": 8.0, "trainingReadiness": 90, "menstrualCyclePhase": null
      },
      "gemini": {
        "predictedFtp": 260, "predictedFtpTrend": "Stable", "predictedVo2": 55.0, "predictedVo2Trend": "Trending Up", "ftpToday": 260, "idealWorkout": "Hard intervals today since readiness is high."
      }
    }
    `;

    const result = await model.generateContent(prompt);
    let outputText = result.response.text().trim();
    
    if (outputText.startsWith("\`\`\`json")) {
        outputText = outputText.replace(/^\`\`\`json\n/, "").replace(/\n\`\`\`$/, "");
    } else if (outputText.startsWith("\`\`\`")) {
        outputText = outputText.replace(/^\`\`\`\n/, "").replace(/\n\`\`\`$/, "");
    }
    
    const parsedData = JSON.parse(outputText);

    // ==========================================
    // 5. SAVE TO DATABASE
    // ==========================================
    console.log("Saving to database...");
    
    // Save or update today's log (use start of day to ensure 1 per day)
    const startOfToday = new Date(today.setHours(0,0,0,0));

    const logged = await prisma.fitnessLog.upsert({
        where: {
            date: startOfToday
        },
        update: {
            rhr: parsedData.garmin?.rhr || null,
            hrv: parsedData.garmin?.hrv || null,
            sleepScore: parsedData.garmin?.sleepScore || null,
            sleepHours: parsedData.garmin?.sleepHours || null,
            trainingReadiness: parsedData.garmin?.trainingReadiness || null,
            menstrualCyclePhase: parsedData.garmin?.menstrualCyclePhase || null,
            
            predictedFtp: parsedData.gemini?.predictedFtp || null,
            predictedFtpTrend: parsedData.gemini?.predictedFtpTrend || null,
            predictedVo2: parsedData.gemini?.predictedVo2 || null,
            predictedVo2Trend: parsedData.gemini?.predictedVo2Trend || null,
            ftpToday: parsedData.gemini?.ftpToday || null,
            idealWorkout: parsedData.gemini?.idealWorkout || null
        },
        create: {
            date: startOfToday,
            rhr: parsedData.garmin?.rhr || null,
            hrv: parsedData.garmin?.hrv || null,
            sleepScore: parsedData.garmin?.sleepScore || null,
            sleepHours: parsedData.garmin?.sleepHours || null,
            trainingReadiness: parsedData.garmin?.trainingReadiness || null,
            menstrualCyclePhase: parsedData.garmin?.menstrualCyclePhase || null,
            
            predictedFtp: parsedData.gemini?.predictedFtp || null,
            predictedFtpTrend: parsedData.gemini?.predictedFtpTrend || null,
            predictedVo2: parsedData.gemini?.predictedVo2 || null,
            predictedVo2Trend: parsedData.gemini?.predictedVo2Trend || null,
            ftpToday: parsedData.gemini?.ftpToday || null,
            idealWorkout: parsedData.gemini?.idealWorkout || null
        }
    });

    return NextResponse.json({ success: true, data: logged });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
