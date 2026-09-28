import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "../../../../lib/db";
import { fallbackExamDetails } from "../../../../lib/catalog";

type ExamDetailRow = RowDataPacket & { name: string; description: string | null; badge: string | null; visual_tone: string; visual_symbol: string; test_count: number };

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const fallback = fallbackExamDetails[slug];

  try {
    const [rows] = await db.query<ExamDetailRow[]>(
      `SELECT e.name, e.description, e.badge, e.visual_tone, e.visual_symbol, COUNT(DISTINCT t.id) AS test_count
       FROM exams e LEFT JOIN test_series ts ON ts.exam_id = e.id AND ts.status = 'published'
       LEFT JOIN tests t ON t.test_series_id = ts.id AND t.status = 'published'
       WHERE e.slug = ? AND e.status = 'published' GROUP BY e.id`, [slug],
    );
    if (rows[0] && fallback) return NextResponse.json({ data: { ...fallback, title: rows[0].name, description: rows[0].description ?? fallback.description, tests: `${rows[0].test_count} tests` }, source: "mysql" });
  } catch {
    // Local development can use the launch catalog before MySQL is initialized.
  }

  return fallback ? NextResponse.json({ data: fallback, source: "fixture", databaseConfigured: false }) : NextResponse.json({ error: "Exam not found" }, { status: 404 });
}
