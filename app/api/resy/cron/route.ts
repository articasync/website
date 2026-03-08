import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Resend } from "resend";

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
  const notificationEmailSetting = await prisma.setting.findUnique({
    where: { key: "notification_email" },
  });

  if (!notificationEmailSetting || !notificationEmailSetting.value) {
    return NextResponse.json(
      { error: "Notification email not set" },
      { status: 400 }
    );
  }

  const notificationEmail = notificationEmailSetting.value;
  const restaurantsToScrape = await prisma.restaurant.findMany();

  if (!restaurantsToScrape.length) {
    return NextResponse.json({ message: "No restaurants to scrape." });
  }

  // 4. RUN THE SCRAPER LOGIC
  const foundSlots: any[] = [];
  const today = new Date();

  for (const restaurant of restaurantsToScrape) {
    for (let i = 0; i < 30; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split("T")[0];

      try {
        const findUrl = `https://api.resy.com/4/find?lat=0&long=0&day=${dateStr}&party_size=4&venue_id=${restaurant.id}`;
        const findResponse = await fetch(findUrl, { headers: HEADERS as any });

        if (!findResponse.ok) {
          console.error(`Error fetching from Resy API: ${findResponse.status}`);
          continue;
        }

        const data = await findResponse.json();
        const venues = data.results?.venues;
        const slots = venues?.[0]?.slots || [];

        for (const slot of slots) {
          const slotTimeStr = slot.date?.start;
          if (!slotTimeStr) continue;

          // Convert to Date treating it as UTC for simplicity or parsing exact strings
          const slotDt = new Date(slotTimeStr.replace("Z", "+00:00"));
          const localHour = slotDt.getHours();

          // Only notify for slots between 5 PM and 10 PM
          if (localHour >= 17 && localHour < 22) {
            const existing = await prisma.notifiedSlot.findUnique({
              where: {
                restaurantId_slotDateTime_partySize: {
                  restaurantId: restaurant.id,
                  slotDateTime: slotDt,
                  partySize: 4,
                },
              },
            });

            if (!existing) {
              // New slot found! Add to list and mark as notified.
              const formattedTime = slotDt.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              });
              const formattedDate = slotDt.toISOString().split("T")[0];

              foundSlots.push({
                restaurant_name: restaurant.name,
                restaurant_slug: restaurant.slug,
                day: formattedDate,
                time: formattedTime,
                party_size: 4,
              });

              await prisma.notifiedSlot.create({
                data: {
                  restaurantId: restaurant.id,
                  slotDateTime: slotDt,
                  partySize: 4,
                },
              });
            }
          }
        }
      } catch (e) {
        console.error(`Error scraping ${restaurant.name} on ${dateStr}:`, e);
      }
    }
  }

  // 5. SEND NOTIFICATIONS
  if (foundSlots.length > 0) {
    for (const slot of foundSlots) {
      const subject = `Resy Alert: ${slot.restaurant_name} at ${slot.time}`;
      const content = `A table for ${slot.party_size} is available at ${slot.restaurant_name} on ${slot.day} at ${slot.time}.\n\nBook here: https://resy.com/cities/ny/${slot.restaurant_slug}?date=${slot.day}&seats=${slot.party_size}`;

      try {
        await resend.emails.send({
          from: "Resy Alert <onboarding@resend.dev>",
          to: [notificationEmail],
          subject: subject,
          text: content,
        });
      } catch (e) {
        console.error("Failed to send email", e);
      }
    }
  }

  // 6. SEND RESPONSE
  return NextResponse.json({ status: "ok", found_slots: foundSlots.length });
}
