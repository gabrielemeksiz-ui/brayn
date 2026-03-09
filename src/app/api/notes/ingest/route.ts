import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    // ton code actuel ici
  } catch (err) {
    console.error("Error in /api/notes/ingest", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
