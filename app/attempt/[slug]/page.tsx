import { notFound } from "next/navigation";
import AttemptClient from "./AttemptClient";
import { getTestAttemptDefinition } from "../../../lib/attempt-store";

export default async function AttemptPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const test = await getTestAttemptDefinition(slug);
  if (!test) notFound();
  return <AttemptClient {...test} testSlug={slug} />;
}
