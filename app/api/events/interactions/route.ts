import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type === "pinned") {
      const pins = await prisma.eventInteraction.findMany({
        where: { pinned: true },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json(pins);
    }

    const interactions = await prisma.eventInteraction.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(interactions);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, time, link, rating, reason, pinned, skipped, spotifyArtistId, musicArtist } = body;

    const interaction = await prisma.eventInteraction.create({
      data: {
        title,
        description,
        time,
        link,
        rating,
        reason,
        pinned: pinned || false,
        skipped: skipped || false,
        spotifyArtistId: spotifyArtistId || null,
        musicArtist: musicArtist || null,
      },
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, rating, reason, pinned, skipped } = body;

    const updated = await prisma.eventInteraction.update({
      where: { id },
      data: { rating, reason, pinned, skipped },
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const deleted = await prisma.eventInteraction.delete({
      where: { id },
    });

    return NextResponse.json(deleted);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
