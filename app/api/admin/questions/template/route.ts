import { NextResponse } from "next/server";

export async function GET() {
  const csvHeaders = [
    "exam",
    "subject",
    "topic",
    "stem",
    "option_a",
    "option_b",
    "option_c",
    "option_d",
    "option_e",
    "correct_option",
    "explanation",
    "difficulty",
    "status",
  ].join(",");

  const sampleRows = [
    [
      `"BPSC TRE 4.0"`,
      `"General Studies"`,
      `"Bihar Geography"`,
      `"Which district of Bihar has the highest literacy rate as per Census 2011?"`,
      `"Patna"`,
      `"Rohtas"`,
      `"Bhojpur"`,
      `"Munger"`,
      `"None of the above / More than one of the above"`,
      `"B"`,
      `"As per Census 2011, Rohtas district recorded the highest overall literacy rate in Bihar at 73.37%."`,
      `"easy"`,
      `"Draft"`,
    ].join(","),
    [
      `"BPSC TRE 4.0"`,
      `"General Studies"`,
      `"Indian National Movement"`,
      `"Who presided over the 1922 Gaya session of the Indian National Congress?"`,
      `"Chittaranjan Das"`,
      `"Motilal Nehru"`,
      `"Rajendra Prasad"`,
      `"Hakim Ajmal Khan"`,
      `"None of the above / More than one of the above"`,
      `"A"`,
      `"Deshbandhu Chittaranjan Das presided over the 37th session of the INC held at Gaya, Bihar in December 1922."`,
      `"medium"`,
      `"Draft"`,
    ].join(","),
    [
      `"Bihar STET"`,
      `"Teaching Art"`,
      `"Classroom Management"`,
      `"Which pedagogical approach best fosters critical thinking and active student engagement?"`,
      `"Rote memorization and repetitive drill"`,
      `"Inquiry-based collaborative problem solving"`,
      `"Unidirectional teacher lecture"`,
      `"Isolated textbook reading"`,
      `""`,
      `"B"`,
      `"Inquiry-based collaborative learning encourages students to explore, question, and construct knowledge through dialogue."`,
      `"medium"`,
      `"Draft"`,
    ].join(","),
    [
      `"CTET"`,
      `"Child Development & Pedagogy"`,
      `"Piaget Theory"`,
      `"According to Jean Piaget, at which stage does a child develop object permanence?"`,
      `"Sensorimotor stage"`,
      `"Preoperational stage"`,
      `"Concrete operational stage"`,
      `"Formal operational stage"`,
      `""`,
      `"A"`,
      `"Object permanence typically develops during the sensorimotor stage (birth to ~2 years)."`,
      `"easy"`,
      `"Draft"`,
    ].join(","),
  ].join("\r\n");

  const csvContent = `${csvHeaders}\r\n${sampleRows}`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="question_import_template.csv"`,
    },
  });
}
