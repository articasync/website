import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const restaurants = await prisma.restaurant.findMany();
    return NextResponse.json(
      restaurants.map((r) => ({ id: r.id, slug: r.slug, name: r.name }))
    );
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { slug } = body;

    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
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

    const newRestaurant = await prisma.restaurant.create({
      data: { id: resyId, slug, name },
    });

    return NextResponse.json(
      { id: newRestaurant.id, slug: newRestaurant.slug, name: newRestaurant.name },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: `Invalid slug or failed to add: ${e.message}` },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 });
    }

    await prisma.restaurant.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Restaurant deleted" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
