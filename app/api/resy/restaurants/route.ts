import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const alerts = await prisma.alert.findMany({
      include: { restaurant: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(
      alerts.map((a) => ({
        id: a.id,
        slug: a.restaurant.slug,
        name: a.restaurant.name,
        email: a.email,
      }))
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
      throw new Error(`Resy API returned status ${resyResponse.status}. Make sure your RESY_API_KEY is correct.`);
    }

    const venueData = await resyResponse.json();
    const resyId = venueData.id?.resy;
    const name = venueData.name;

    if (!resyId || !name) {
      throw new Error("Invalid Resy slug or missing data in API response");
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
