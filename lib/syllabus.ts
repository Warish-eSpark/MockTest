export type SubjectGroup = {
  name: string;
  description: string;
  topics: string[];
};

export type ExamTrack = {
  slug: string;
  name: string;
  audience: string;
  subjects: SubjectGroup[];
};

const languages = ["Grammar & language use", "Vocabulary", "Prose & poetry", "Literary history", "Comprehension", "Authors & works"];
const socialScience = ["History", "Geography", "Political science", "Economics"];
const commonTeaching = ["Teaching & learning", "Lesson planning", "Classroom management", "Assessment & evaluation", "Inclusive education", "Educational psychology"];

export const syllabusTracks: Record<string, ExamTrack[]> = {
  "bpsc-tre-4": [
    { slug: "primary-1-5", name: "Classes 1–5", audience: "Primary teacher recruitment", subjects: [
      { name: "Language", description: "English, Hindi, Urdu and Bangla language foundations", topics: languages },
      { name: "Elementary Mathematics", description: "Primary-level quantitative and data skills", topics: ["Number system", "Fractions & decimals", "Ratio & percentage", "Geometry & mensuration", "Time, work & distance", "Data interpretation"] },
      { name: "General Studies", description: "The primary-level core without a separate concerned-subject paper", topics: ["Bihar & India GK", "General science", "Indian national movement", "Geography", "Environment", "Mental ability & reasoning"] },
    ] },
    { slug: "middle-6-8", name: "Classes 6–8", audience: "Middle school concerned subject", subjects: [
      { name: "Mathematics & Science", description: "Combined middle-school subject group", topics: ["Number system & algebra", "Geometry & mensuration", "Data handling", "Matter & physical changes", "Force, work & energy", "Cells, plants & human body", "Environment & ecology"] },
      { name: "Social Science", description: "A grouped subject with history, geography, civics and economics", topics: socialScience },
      { name: "Languages", description: "Hindi, Urdu, Sanskrit and English", topics: languages },
    ] },
    { slug: "secondary-9-10", name: "Classes 9–10", audience: "Secondary subject specialist", subjects: [
      { name: "Mathematics", description: "Secondary mathematics with graduation-level preparation depth", topics: ["Real numbers", "Polynomials", "Quadratic equations", "Coordinate geometry", "Trigonometry", "Statistics & probability"] },
      { name: "Science", description: "Physics, chemistry, biology and environmental science", topics: ["Motion & laws", "Electricity & magnetism", "Atomic structure", "Chemical reactions", "Cell & genetics", "Ecology & conservation"] },
      { name: "Social Science", description: "History, geography, political science and economics", topics: socialScience },
      { name: "Languages & Arts", description: "Hindi, Urdu, Sanskrit, English, Bangla, Maithili, Arabic, Persian, Fine Arts, Music and Dance", topics: languages },
    ] },
    { slug: "higher-secondary-11-12", name: "Classes 11–12", audience: "Higher secondary subject specialist", subjects: [
      { name: "Mathematics", description: "Algebra, calculus, coordinate and advanced mathematics", topics: ["Sets & relations", "Algebra", "Calculus", "Vectors & 3D geometry", "Probability & statistics", "Linear algebra"] },
      { name: "Science", description: "Physics, chemistry, botany and zoology", topics: ["Mechanics & thermodynamics", "Electrostatics & optics", "Organic & physical chemistry", "Plant physiology & genetics", "Animal physiology & ecology"] },
      { name: "Social Sciences", description: "History, geography, political science, economics, sociology, psychology and philosophy", topics: socialScience.concat(["Sociology", "Psychology", "Philosophy"]) },
      { name: "Computer Science", description: "The dedicated technical subject pathway", topics: ["Programming", "Data structures & algorithms", "Operating systems", "DBMS & SQL", "Computer networks", "Web technologies & security", "AI and cloud basics"] },
      { name: "Commerce & Agriculture", description: "Commerce, accountancy, business studies, entrepreneurship and agriculture", topics: ["Accounting", "Business management", "Business law", "Entrepreneurship", "Agronomy", "Soil science & horticulture"] },
    ] },
  ],
  "bihar-stet": [
    { slug: "paper-1-9-10", name: "Paper I · Classes 9–10", audience: "Secondary teacher eligibility", subjects: [
      { name: "Languages", description: "Hindi, Urdu, Bangla, Maithili, Sanskrit, Arabic, Persian, Bhojpuri and English", topics: languages.concat(["Translation", "Prosody & poetics"]) },
      { name: "Mathematics", description: "Paper I subject preparation at the applicable graduation level", topics: ["Real numbers & algebra", "Geometry & trigonometry", "Calculus foundations", "Statistics & probability", "Coordinate geometry"] },
      { name: "Science", description: "Physics, chemistry, biology and environmental science", topics: ["Mechanics & electricity", "Matter & chemical reactions", "Cell, genetics & physiology", "Ecology & conservation"] },
      { name: "Social Science", description: "History, geography, political science and economics", topics: socialScience },
      { name: "Arts & Physical Education", description: "Physical Education, Music, Fine Arts and Dance", topics: ["Theory & foundations", "History & traditions", "Practice terminology", "Health, training & evaluation"] },
      { name: "Teaching Art & Other Skills", description: "Common 50-mark component", topics: commonTeaching.concat(["Communication", "General knowledge", "Environmental science", "Mathematical aptitude", "Logical reasoning"]) },
    ] },
    { slug: "paper-2-11-12", name: "Paper II · Classes 11–12", audience: "Higher secondary teacher eligibility", subjects: [
      { name: "Languages", description: "Hindi, Urdu, English, Sanskrit, Bangla, Maithili, Magahi, Arabic, Persian, Bhojpuri, Pali and Prakrit", topics: languages.concat(["Linguistics", "Literary criticism", "Translation & poetics"]) },
      { name: "Science", description: "Mathematics, physics, chemistry, botany and zoology", topics: ["Advanced mathematics", "Mechanics, optics & modern physics", "Organic, inorganic & physical chemistry", "Plant biology", "Animal biology"] },
      { name: "Social Sciences", description: "History, geography, political science, economics, sociology, psychology and philosophy", topics: socialScience.concat(["Sociological theory", "Psychology", "Indian & western philosophy"]) },
      { name: "Computer Science", description: "Paper II subject code 226", topics: ["Programming", "Data structures", "Operating systems", "DBMS & SQL", "Networks", "Security & cryptography", "AI & data mining"] },
      { name: "Commerce & Agriculture", description: "Commerce, home science and agriculture pathways", topics: ["Accounting & auditing", "Business management", "Nutrition & human development", "Agronomy", "Plant breeding & pathology"] },
      { name: "Teaching Art & Other Skills", description: "Common teaching and general skills component", topics: commonTeaching },
    ] },
  ],
};

export const mockTests = Object.values(syllabusTracks).flatMap((tracks) => tracks.flatMap((track) => track.subjects.slice(0, 3).map((subject, index) => ({
  slug: `${track.slug}-${subject.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-mock`,
  exam: tracks === syllabusTracks["bpsc-tre-4"] ? "BPSC TRE 4.0" : "Bihar STET",
  track: track.name,
  subject: subject.name,
  name: `${subject.name}: ${index === 0 ? "Full Mock 01" : "Focus Practice"}`,
  questions: index === 0 ? 150 : 40,
  duration: index === 0 ? "150 min" : "40 min",
  access: index === 0 ? "Free" : "Premium",
  type: index === 0 ? "Full mock" : "Subject test",
}))));
