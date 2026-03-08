import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const emailSetting = await prisma.setting.findUnique({
      where: { key: "notification_email" },
    });

    const emailValue = emailSetting?.value || "";

    return NextResponse.json({ email: emailValue });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    await prisma.setting.upsert({
      where: { key: "notification_email" },
      create: { key: "notification_email", value: email },
      update: { value: email },
    });

    return NextResponse.json({ message: "Email saved successfully" });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
