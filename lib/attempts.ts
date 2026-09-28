export type AttemptQuestion = {
  id: number;
  section: string;
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export const bpscGeneralStudiesQuestions: AttemptQuestion[] = [
  { id: 1, section: "General Studies", prompt: "Which river is known as the ‘Sorrow of Bihar’ because of its frequent flooding?", options: ["Ganga", "Kosi", "Son", "Gandak", "None of these"], correctIndex: 1, explanation: "The Kosi is widely known as the Sorrow of Bihar because of its historical flood patterns." },
  { id: 2, section: "General Studies", prompt: "The Champaran Satyagraha of 1917 was primarily associated with which crop?", options: ["Cotton", "Opium", "Indigo", "Jute", "None of these"], correctIndex: 2, explanation: "The movement opposed forced indigo cultivation by European planters in Champaran." },
  { id: 3, section: "Elementary Mathematics", prompt: "If a number is increased by 20% and then decreased by 20%, the resulting value is:", options: ["The same", "4% less", "4% more", "2% less", "Cannot be determined"], correctIndex: 1, explanation: "Using 100 as the base gives 120 × 0.8 = 96, which is 4% less." },
  { id: 4, section: "Mental Ability", prompt: "Find the next number in the series: 3, 6, 12, 24, ?", options: ["36", "42", "48", "54", "60"], correctIndex: 2, explanation: "Each number is multiplied by 2, so the next number is 48." },
  { id: 5, section: "General Science", prompt: "Which part of a plant cell is primarily responsible for photosynthesis?", options: ["Nucleus", "Mitochondria", "Chloroplast", "Ribosome", "None of these"], correctIndex: 2, explanation: "Chloroplasts contain chlorophyll and are the site of photosynthesis." },
];

export const attemptFixtures: Record<string, { title: string; exam: string; durationSeconds: number; questions: AttemptQuestion[] }> = {
  "bpsc-tre-4-general-studies": { title: "General Studies: Full Mock 01", exam: "BPSC TRE 4.0", durationSeconds: 9000, questions: bpscGeneralStudiesQuestions },
};
