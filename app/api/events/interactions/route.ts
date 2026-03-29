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
    const { title, description, time, rating, reason, pinned, skipped } = body;

    const interaction = await prisma.eventInteraction.create({
      data: {
        title,
        description,
        time,
        rating,
        reason,
        pinned: pinned || false,
        skipped: skipped || false,
      },
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
