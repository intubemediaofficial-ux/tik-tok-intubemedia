import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/security";
import { getFeed, type FeedKind } from "@/lib/videos";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = (["foryou", "following", "friends"].includes(url.searchParams.get("kind") ?? "") ? url.searchParams.get("kind") : "foryou") as FeedKind;
  const exclude = (url.searchParams.get("exclude") ?? "").split(",").filter(Boolean).slice(-400);
  const user = await getCurrentUser();
  const videos = await getFeed(kind, user?.id, exclude, 6);
  return NextResponse.json({ videos });
}
