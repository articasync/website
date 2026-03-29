import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const setting = await prisma.setting.findUnique({
      where: { key: "event_guidance" },
    });
    return NextResponse.json({ guidance: setting?.value || "" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { guidance } = body;

    const setting = await prisma.setting.upsert({
      where: { key: "event_guidance" },
      update: { value: guidance },
      create: { key: "event_guidance", value: guidance },
    });

    return NextResponse.json(setting);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
