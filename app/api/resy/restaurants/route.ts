import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const alerts = await prisma.alert.findMany({
      include: { restaurant: true },
      orderBy: { createdAt: "desc" },
    });

    const restaurantIds = Array.from(new Set(alerts.map((a: any) => a.restaurantId)));
    const latestSlotsData = await Promise.all(
      restaurantIds.map(async (id) => {
        return await prisma.notifiedSlot.findFirst({
          where: { restaurantId: id },
          orderBy: { createdAt: "desc" },
        });
      })
    );

    const lastNotifiedMap = new Map();
    latestSlotsData.forEach((slot) => {
      if (slot) {
        lastNotifiedMap.set(slot.restaurantId, slot);
      }
    });

    return NextResponse.json(
      alerts.map((a: any) => {
        const lastSlot = lastNotifiedMap.get(a.restaurantId);
        return {
          id: a.id,
          slug: a.restaurant.slug,
          name: a.restaurant.name,
          email: a.email,
          lastCheckedAt: a.restaurant.lastCheckedAt,
          lastCheckStatus: a.restaurant.lastCheckStatus,
          lastNotifiedAt: lastSlot?.createdAt,
          lastNotifiedSlotDate: lastSlot?.slotDateTime,
        };
      })
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug, email } = body;

    if (!slug || !email) {
      return NextResponse.json({ error: "Slug and Email are required" }, { status: 400 });
    }

    const HEADERS = {
      Authorization: `ResyAPI api_key="${process.env.RESY_API_KEY}"`,
    };

    const resyResponse = await fetch(
      `https://api.resy.com/3/venue?url_slug=${slug}&location=ny`,
      { headers: HEADERS }
    );

    if (!resyResponse.ok) {
      if (resyResponse.status === 404) {
        throw new Error(`Resy could not find a restaurant with the slug "${slug}". Please check the spelling.`);
      }
      throw new Error(`Resy API returned status ${resyResponse.status}. Make sure your RESY_API_KEY is correct.`);
    }

    const venueData = await resyResponse.json();
    const resyId = venueData.id?.resy;
    const name = venueData.name;

    if (!resyId || !name) {
      throw new Error("Invalid Resy slug or missing data in API response");
    }

    // Check availability over the next 7 days between 5 PM and 9 PM
    const today = new Date();
    let totalSlotsFound = 0;
    const fetchPromises = [];

    for (let i = 0; i < 7; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() + i);
      const dateStr = checkDate.toISOString().split("T")[0];
      const findUrl = `https://api.resy.com/4/find?lat=0&long=0&day=${dateStr}&party_size=2&venue_id=${resyId}`;
      fetchPromises.push(fetch(findUrl, { headers: HEADERS as any }).then(res => res.json()).catch(() => null));
    }

    const results = await Promise.all(fetchPromises);
    for (const data of results) {
      if (!data) continue;
      const slots = data.results?.venues?.[0]?.slots || [];
      for (const slot of slots) {
        const slotTimeStr = slot.date?.start;
        if (!slotTimeStr) continue;
        const slotDt = new Date(slotTimeStr.replace(" ", "T") + "Z");
        const localHour = slotDt.getUTCHours();
        // Only count prime time slots
        if (localHour >= 17 && localHour < 21) {
          totalSlotsFound++;
        }
      }
    }

    if (totalSlotsFound > 2) {
      return NextResponse.json(
        {
          error: `We found ${totalSlotsFound} open prime-time tables for ${name} over the next 7 days. This restaurant is currently too easy to book to warrant an alert!`,
          resyUrl: `https://resy.com/cities/ny/${slug}`
        },
        { status: 400 }
      );
    }

    // Upsert the restaurant to ensure it exists
    const restaurant = await prisma.restaurant.upsert({
      where: { id: resyId },
      create: { id: resyId, slug, name },
      update: { slug, name }, // ensure latest slug/name is saved
    });

    // Create the alert mapping for this email
    const newAlert = await prisma.alert.create({
      data: {
        restaurantId: restaurant.id,
        email,
      },
      include: { restaurant: true },
    });

    return NextResponse.json(
      {
        id: newAlert.id,
        slug: newAlert.restaurant.slug,
        name: newAlert.restaurant.name,
        email: newAlert.email,
      },
      { status: 201 }
    );
  } catch (e: any) {
    // Check for unique constraint violation (P2002) in Prisma
    if (e.code === 'P2002') {
      return NextResponse.json({ error: "This email is already monitoring this restaurant." }, { status: 400 });
    }
    return NextResponse.json(
      { error: `Failed to add: ${e.message}` },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id"); // This is the ID of the Alert, not Restaurant.

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.alert.delete({
      where: { id: id },
    });

    return NextResponse.json({ message: "Alert deleted" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
