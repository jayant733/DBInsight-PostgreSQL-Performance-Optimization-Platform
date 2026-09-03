import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeAndSave } from "@/lib/analyzer/analyze";
import { listAnalyses } from "@/lib/analyzer/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  title: z.string().trim().min(1).max(120),
  sql: z.string().trim().min(1).max(16_384),
});

function databaseError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const setupMissing =
    message.includes("analyzer.analyses") ||
    message.includes("querylab_app") ||
    message.includes("password authentication");

  return NextResponse.json(
    {
      error: setupMissing
        ? "Analyzer database setup is missing. Run sql/analyzer_schema.sql as the postgres user."
        : "The analyzer could not connect to local PostgreSQL.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  try {
    return NextResponse.json({ analyses: await listAnalyses(limit) });
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeAndSave(
      parsed.data.title,
      parsed.data.sql,
    );
    return NextResponse.json({ analysis }, { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}
