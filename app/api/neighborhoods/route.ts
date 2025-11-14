import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

export async function GET(request: NextRequest) {
  try {
    const client = new ConvexHttpClient(CONVEX_URL);

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit")
      ? parseInt(searchParams.get("limit")!)
      : 10;

    // Query neighborhoods from Convex
    const neighborhoods = await client.query(api.neighborhoods.listNeighborhoods, {
      limit,
    });

    return NextResponse.json(neighborhoods);
  } catch (error) {
    console.error("Error fetching neighborhoods:", error);
    return NextResponse.json(
      { error: "Failed to fetch neighborhoods" },
      { status: 500 }
    );
  }
}
