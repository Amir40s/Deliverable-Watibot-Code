import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppointmentsClient from "./AppointmentsClient";

export const metadata = {
  title: "Appointments & Bookings | WatiBot",
  description: "View and manage AI-booked and manual customer appointments.",
};

export default async function AppointmentsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    redirect("/login");
  }

  return <AppointmentsClient />;
}
