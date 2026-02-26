import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const FAVICON_PATH = join(process.cwd(), "public", "images", "legacy", "png", "grrrignote_logo.png");

export async function GET() {
  try {
    const content = await readFile(FAVICON_PATH);
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
