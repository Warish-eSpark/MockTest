import { NextRequest, NextResponse } from "next/server";
import { featuredExams } from "../../../lib/catalog";
import { adminQuestions, adminTests, notifications } from "../../../lib/phase1";

export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!query) return NextResponse.json({ data: [] });
  const data = [
    ...featuredExams.filter((item) => `${item.title} ${item.meta}`.toLowerCase().includes(query)).map((item) => ({ type: "Exam", title: item.title, detail: item.meta, href: `/exams/${item.slug}` })),
    ...adminTests.filter((item) => `${item.name} ${item.exam} ${item.type}`.toLowerCase().includes(query)).map((item) => ({ type: "Mock test", title: item.name, detail: `${item.exam} · ${item.type}`, href: `/tests/${item.id}` })),
    ...adminQuestions.filter((item) => `${item.stem} ${item.subject} ${item.topic}`.toLowerCase().includes(query)).map((item) => ({ type: "Question", title: item.stem, detail: `${item.subject} · ${item.topic}`, href: "/tests" })),
    ...notifications.filter((item) => `${item.title} ${item.organization} ${item.category}`.toLowerCase().includes(query)).map((item) => ({ type: "Notification", title: item.title, detail: item.organization, href: `/exams/${item.examSlug}` })),
  ];
  return NextResponse.json({ data });
}
