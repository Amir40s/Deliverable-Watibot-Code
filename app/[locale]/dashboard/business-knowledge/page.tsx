import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import BusinessKnowledgeClient from "./BusinessKnowledgeClient";

export const metadata = {
  title: "AI Business Knowledge & Commerce | WatiBot",
  description: "Configure store info, products, delivery rules, services and appointment settings for AI customer interactions.",
};

export default async function BusinessKnowledgePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  return <BusinessKnowledgeClient />;
}
