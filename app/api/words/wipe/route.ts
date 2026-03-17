import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const deleted = await prisma.dailyWord.deleteMany({});
    return NextResponse.json({ message: `Successfully wiped ${deleted.count} historical words! You can now refresh your Words tab to magically see 2 brand new randomly selected words.` });
  } catch (error) {
    return NextResponse.json({ error: "Failed to wipe words." }, { status: 500 });
  }
}
