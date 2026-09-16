import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import OrdersClient from "./OrdersClient";

export const metadata = {
  title: "Orders Management | WatiBot",
  description: "View and manage AI-generated and manual customer orders.",
};

export default async function OrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  return <OrdersClient />;
}
