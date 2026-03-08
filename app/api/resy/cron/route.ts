import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";

export const maxDuration = 300; // Allow Vercel to run up to 5 minutes (300 seconds) if they have the plan that supports it
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // 1. AUTHENTICATE THE CRON JOB
  const authHeader = request.headers.get("Authorization");
  const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

  if (!authHeader || authHeader !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. SETUP CLIENTS AND HEADERS
  const HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Authorization: `ResyAPI api_key="${process.env.RESY_API_KEY}"`,
    Accept: "application/json, text/plain, */*",
    Origin: "https://resy.com",
    "X-Origin": "https://resy.com",
    "Content-Type": "application/json",
  };

  const resend = new Resend(process.env.RESEND_API_KEY);

  // 3. GET DATA FROM DATABASE
  const alerts = await prisma.alert.findMany({
    include: { restaurant: true },
  });

  if (!alerts.length) {
    return NextResponse.json({ message: "No alerts configured." });
  }

  // Create a map of restaurants we need to scrape, and who to email for each
  const jobs: { [restaurantId: number]: { restaurant: any; emails: string[] } } = {};
  for (const alert of alerts) {
    if (!jobs[alert.restaurantId]) {
      jobs[alert.restaurantId] = {
        restaurant: alert.restaurant,
        emails: [],
      };
    }
    jobs[alert.restaurantId].emails.push(alert.email);
  }

  // 4. RUN THE SCRAPER LOGIC
  const foundSlots: any[] = [];
  const today = new Date();

  for (const [idStr, jobData] of Object.entries(jobs)) {
    const restaurant = jobData.restaurant;
    const emails = jobData.emails;

    console.log(`Starting 30-day availability check for: ${restaurant.name}`);
    let totalSlotsFoundForRestaurant = 0;
    let checkStatus = "200 OK";

    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split("T")[0];

      try {
        const findUrl = `https://api.resy.com/4/find?lat=0&long=0&day=${dateStr}&party_size=2&venue_id=${restaurant.id}`;
        const findResponse = await fetch(findUrl, { headers: HEADERS as any });

        if (!findResponse.ok) {
          console.error(`Error fetching from Resy API: ${findResponse.status}`);
          checkStatus = `Error ${findResponse.status}`;
          continue;
        }

        const data = await findResponse.json();
        const venues = data.results?.venues;
        const slots = venues?.[0]?.slots || [];
        totalSlotsFoundForRestaurant += slots.length;

        for (const slot of slots) {
          const slotTimeStr = slot.date?.start;
          if (!slotTimeStr) continue;

          // Convert to Date treating it as UTC for simplicity or parsing exact strings
          // Resy time is local time, e.g. "2024-05-15 18:00:00"
          // We append Z and use getUTCHours() to accurately extract the literal hour without Vercel's timezone shifting it
          const slotDt = new Date(slotTimeStr.replace(" ", "T") + "Z");
          const localHour = slotDt.getUTCHours();

          // Only notify for slots between 5 PM and 10 PM
          if (localHour >= 17 && localHour < 22) {
            const existing = await prisma.notifiedSlot.findUnique({
              where: {
                restaurantId_slotDateTime_partySize: {
                  restaurantId: restaurant.id,
                  slotDateTime: slotDt,
                  partySize: 2,
                },
              },
            });

            if (!existing) {
              // New slot found! Add to list and mark as notified.
              const formattedTime = slotDt.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: 'UTC'
              });
              const formattedDate = slotDt.toISOString().split("T")[0];

              foundSlots.push({
                restaurant_name: restaurant.name,
                restaurant_slug: restaurant.slug,
                day: formattedDate,
                time: formattedTime,
                party_size: 2,
                emails: emails,
              });

              await prisma.notifiedSlot.create({
                data: {
                  restaurantId: restaurant.id,
                  slotDateTime: slotDt,
                  partySize: 2,
                },
              });
            }
          }
        }
      } catch (e: any) {
        console.error(`Error scraping ${restaurant.name} on ${dateStr}:`, e);
        checkStatus = "Error";
      }
    }

    console.log(`Finished checking ${restaurant.name}. Resy returned ${totalSlotsFoundForRestaurant} total slots across 30 days.`);

    // Update the restaurant's last check status
    try {
      await prisma.restaurant.update({
        where: { id: restaurant.id },
        data: {
          lastCheckedAt: new Date(),
          lastCheckStatus: checkStatus,
        },
      });
    } catch (e) {
      console.error(`Failed to update status for ${restaurant.name}`, e);
    }
  }

  // 5. SEND NOTIFICATIONS (Grouped to at most 1 email per user)
  if (foundSlots.length > 0) {
    const emailsToSend: { [email: string]: any[] } = {};
    for (const slot of foundSlots) {
      for (const email of slot.emails) {
        if (!emailsToSend[email]) emailsToSend[email] = [];
        emailsToSend[email].push(slot);
      }
    }

    for (const [email, slots] of Object.entries(emailsToSend)) {
      const subject = `Resy Alert: ${slots.length} table(s) found!`;
      let content = `We found ${slots.length} table(s) matching your alerts:\n\n`;

      for (const slot of slots) {
        content += `- ${slot.restaurant_name} on ${slot.day} at ${slot.time} (Party of ${slot.party_size})\n`;
        content += `  Book here: https://resy.com/cities/ny/${slot.restaurant_slug}?date=${slot.day}&seats=${slot.party_size}\n\n`;
      }

      try {
        await resend.emails.send({
          from: "Resy Alert <onboarding@resend.dev>",
          to: [email],
          subject: subject,
          text: content,
        });
      } catch (e) {
        console.error("Failed to send email to", email, e);
      }
    }
  }

  // 6. SEND RESPONSE
  return NextResponse.json({ status: "ok", found_slots: foundSlots.length });
}
