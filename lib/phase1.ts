export type ContentStatus = "Draft" | "In review" | "Approved" | "Published" | "Archived";

export type QuestionOption = { key: string; text: string; correct: boolean };

export type AdminQuestion = {
  id: string;
  exam: string;
  subject: string;
  topic: string;
  stem: string;
  explanation?: string;
  difficulty?: "easy" | "medium" | "hard";
  status: ContentStatus;
  options?: QuestionOption[];
  usedIn: string[];
};
export type RuleProfile = { id: string; exam: string; version: number; options: number; correctMarks: string; wrongMarks: string; unansweredMarks: string; status: ContentStatus; source: string };
export type AdminTest = { id: string; name: string; exam: string; type: string; questions: number; duration: string; access: "Free" | "Premium"; status: ContentStatus };
export type Plan = { id: string; name: string; description: string; price: string; validity: string; badge?: string; includes: string[] };
export type Notification = { id: string; title: string; organization: string; category: string; date: string; status: "Open" | "Closing soon" | "Announced"; summary: string; examSlug: string };

export const adminQuestions: AdminQuestion[] = [
  {
    id: "q-001",
    exam: "BPSC TRE 4.0",
    subject: "General Studies",
    topic: "Bihar Geography",
    stem: "Which river is known as the Sorrow of Bihar?",
    explanation: "The Kosi River is known as the Sorrow of Bihar because its recurring annual floods cause severe devastation in northern Bihar.",
    difficulty: "easy",
    status: "Published",
    options: [
      { key: "A", text: "Ganga", correct: false },
      { key: "B", text: "Kosi", correct: true },
      { key: "C", text: "Son", correct: false },
      { key: "D", text: "Gandak", correct: false },
      { key: "E", text: "None of the above / More than one of the above", correct: false }
    ],
    usedIn: ["General Studies: Full Mock 01"]
  },
  {
    id: "q-002",
    exam: "Bihar STET",
    subject: "Teaching Art",
    topic: "Assessment & Evaluation",
    stem: "Which assessment is conducted during instruction to improve learning?",
    explanation: "Formative assessment is continuous diagnostic assessment during instruction that provides immediate feedback to students and teachers.",
    difficulty: "medium",
    status: "In review",
    options: [
      { key: "A", text: "Summative assessment", correct: false },
      { key: "B", text: "Formative assessment", correct: true },
      { key: "C", text: "Diagnostic assessment", correct: false },
      { key: "D", text: "Norm-referenced assessment", correct: false }
    ],
    usedIn: []
  },
  {
    id: "q-003",
    exam: "BPSC TRE 4.0",
    subject: "Mathematics",
    topic: "Percentage",
    stem: "If a number rises by 20% and then falls by 20%, what is the net percentage change?",
    explanation: "Net change = +20 - 20 - (20 * 20)/100 = -4% (a 4% decrease).",
    difficulty: "medium",
    status: "Draft",
    options: [
      { key: "A", text: "No change", correct: false },
      { key: "B", text: "4% decrease", correct: true },
      { key: "C", text: "4% increase", correct: false },
      { key: "D", text: "2% decrease", correct: false },
      { key: "E", text: "None of the above / More than one of the above", correct: false }
    ],
    usedIn: []
  },
];

export const ruleProfiles: RuleProfile[] = [
  { id: "rule-bpsc-v1", exam: "BPSC TRE 4.0", version: 1, options: 5, correctMarks: "+1", wrongMarks: "-0.25", unansweredMarks: "0", status: "Published", source: "Official exam instructions" },
  { id: "rule-stet-v1", exam: "Bihar STET", version: 1, options: 4, correctMarks: "+1", wrongMarks: "0", unansweredMarks: "0", status: "Published", source: "Official exam instructions" },
];

export const adminTests: AdminTest[] = [
  { id: "test-bpsc-001", name: "General Studies: Full Mock 01", exam: "BPSC TRE 4.0", type: "Full mock", questions: 150, duration: "150 min", access: "Free", status: "Published" },
  { id: "test-stet-001", name: "Paper I: Complete Mock 01", exam: "Bihar STET", type: "Full mock", questions: 150, duration: "150 min", access: "Free", status: "Draft" },
];

export const plans: Plan[] = [
  { id: "free", name: "Free learner", description: "Start practicing without commitment.", price: "₹0", validity: "Forever", includes: ["Free mock tests", "Basic score", "Exam directory"] },
  { id: "bpsc-complete", name: "BPSC Complete", description: "Focused practice for the full TRE journey.", price: "₹499", validity: "90 days", badge: "Launch offer", includes: ["128 BPSC tests", "Detailed analytics", "Solutions & explanations", "Weak-topic practice"] },
  { id: "all-access", name: "All access", description: "One calm workspace for every launch exam.", price: "₹899", validity: "180 days", badge: "Best value", includes: ["All exam series", "Unlimited analytics", "Priority new tests", "Progress history"] },
];

export const notifications: Notification[] = [
  { id: "notice-001", title: "BPSC TRE 4.0 application window", organization: "Bihar Public Service Commission", category: "Teacher recruitment", date: "28 Sep 2026", status: "Open", summary: "Keep your application timeline and latest practice series together.", examSlug: "bpsc-tre-4" },
  { id: "notice-002", title: "Bihar STET 2026 Paper II subject list", organization: "Bihar School Examination Board", category: "Eligibility test", date: "24 Sep 2026", status: "Announced", summary: "Review the 29 higher-secondary subject pathways before choosing your track.", examSlug: "bihar-stet" },
  { id: "notice-003", title: "CTET preparation cycle update", organization: "Central Board of Secondary Education", category: "Teacher eligibility", date: "18 Sep 2026", status: "Closing soon", summary: "Use the refreshed Paper I mock series for your next focused session.", examSlug: "ctet" },
];
