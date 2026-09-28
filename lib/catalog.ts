export type FeaturedExam = {
  slug: string;
  title: string;
  meta: string;
  tests: string;
  badge: string;
  tone: string;
  symbol: string;
};

export const featuredExams: FeaturedExam[] = [
  { slug: "bpsc-tre-4", title: "BPSC TRE 4.0", meta: "Teacher Recruitment Exam", tests: "128 tests", badge: "Popular", tone: "saffron", symbol: "✦" },
  { slug: "bihar-stet", title: "Bihar STET", meta: "State Teacher Eligibility Test", tests: "86 tests", badge: "Trending", tone: "blue", symbol: "◒" },
  { slug: "ctet", title: "CTET", meta: "Central Teacher Eligibility Test", tests: "214 tests", badge: "New series", tone: "mint", symbol: "⌁" },
];

export type ExamDetail = FeaturedExam & {
  description: string;
  questionCount: number;
  duration: string;
  correctMarks: string;
  wrongMarks: string;
  optionCount: number;
  series: { slug: string; name: string; type: string; questions: number; duration: string; access: "Free" | "Premium" }[];
};

export const fallbackExamDetails: Record<string, ExamDetail> = {
  "bpsc-tre-4": { ...featuredExams[0], description: "Build exam-day confidence with realistic teacher recruitment practice, previous-year patterns, and focused subject tests.", questionCount: 150, duration: "2 hr 30 min", correctMarks: "+1", wrongMarks: "-0.25", optionCount: 5, series: [{ slug: "bpsc-tre-4-general-studies", name: "General Studies: Full Mock 01", type: "Full mock", questions: 150, duration: "150 min", access: "Free" }, { slug: "bpsc-tre-4-teaching-aptitude", name: "Teaching Aptitude Essentials", type: "Subject test", questions: 50, duration: "45 min", access: "Premium" }, { slug: "bpsc-tre-4-pyq", name: "Previous Year Questions", type: "PYQ practice", questions: 100, duration: "100 min", access: "Premium" }] },
  "bihar-stet": { ...featuredExams[1], description: "Prepare for the Bihar State Teacher Eligibility Test with structured practice across pedagogy, language, and subject knowledge.", questionCount: 150, duration: "2 hr 30 min", correctMarks: "+1", wrongMarks: "No negative marking", optionCount: 4, series: [{ slug: "bihar-stet-paper-1", name: "Paper I: Complete Mock 01", type: "Full mock", questions: 150, duration: "150 min", access: "Free" }, { slug: "bihar-stet-pedagogy", name: "Child Development & Pedagogy", type: "Subject test", questions: 30, duration: "30 min", access: "Premium" }] },
  ctet: { ...featuredExams[2], description: "Sharpen your CTET preparation with clean, focused practice that shows what to revise next.", questionCount: 150, duration: "2 hr 30 min", correctMarks: "+1", wrongMarks: "No negative marking", optionCount: 4, series: [{ slug: "ctet-paper-1", name: "Paper I: Full Mock 01", type: "Full mock", questions: 150, duration: "150 min", access: "Free" }, { slug: "ctet-cdp", name: "CDP Focus Practice", type: "Topic test", questions: 30, duration: "30 min", access: "Premium" }] },
};