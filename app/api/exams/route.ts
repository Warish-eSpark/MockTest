import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { db } from "../../../lib/db";
import { featuredExams } from "../../../lib/catalog";

type ExamRow = RowDataPacket & {
  name: string;
  description: string | null;
  badge: string | null;
  visual_tone: string;
  visual_symbol: string;
  test_count: number;
};

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim();

  try {
    const search = query ? `%${query}%` : "%";
    const [rows] = await db.query<ExamRow[]>(
      `SELECT e.name, e.description, e.badge, e.visual_tone, e.visual_symbol,
        COUNT(DISTINCT t.id) AS test_count
       FROM exams e
       LEFT JOIN test_series ts ON ts.exam_id = e.id AND ts.status = 'published'
       LEFT JOIN tests t ON t.test_series_id = ts.id AND t.status = 'published'
       WHERE e.status = 'published' AND (e.name LIKE ? OR e.description LIKE ?)
       GROUP BY e.id
       ORDER BY e.updated_at DESC`,
      [search, search],
    );

    return NextResponse.json({ data: rows, source: "mysql" });
  } catch {
    const data = query
      ? featuredExams.filter((exam) => `${exam.title} ${exam.meta}`.toLowerCase().includes(query.toLowerCase()))
      : featuredExams;

    return NextResponse.json({ data, source: "fixture", databaseConfigured: false });
  }
}