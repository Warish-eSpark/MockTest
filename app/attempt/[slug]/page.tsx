import { notFound } from "next/navigation";
import AttemptClient from "./AttemptClient";
import { attemptFixtures } from "../../../lib/attempts";

export default async function AttemptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const test = attemptFixtures[slug];
  if (!test) notFound();
  return <AttemptClient {...test} testSlug={slug} />;
}
