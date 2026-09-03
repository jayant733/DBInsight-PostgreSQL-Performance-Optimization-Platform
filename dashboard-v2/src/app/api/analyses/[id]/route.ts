import { NextResponse } from "next/server";
import {
  deleteAnalysis,
  getAnalysis,
} from "@/lib/analyzer/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const analysis = await getAnalysis(id);
    if (!analysis) {
      return NextResponse.json({ error: "Analysis not found." }, { status: 404 });
    }
    return NextResponse.json({ analysis });
  } catch {
    return NextResponse.json(
      { error: "Could not load the saved analysis." },
      { status: 503 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const deleted = await deleteAnalysis(id);
    return deleted
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json({ error: "Analysis not found." }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "Could not delete the saved analysis." },
      { status: 503 },
    );
  }
}
