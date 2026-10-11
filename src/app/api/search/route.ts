import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security";
import { searchAll } from "@/lib/search";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  const user = await getCurrentUser();
  if (!q) return NextResponse.json({ users: [], videos: [], sounds: [], hashtags: [], lives: [] });
  return NextResponse.json(await searchAll(q, user?.id, Number(url.searchParams.get("limit")) || 20));
}
