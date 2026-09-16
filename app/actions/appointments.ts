"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { generateAppointmentNumber } from "@/lib/ai/commerce-tools";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }
  return session.user.organizationId;
}

export async function getAppointmentsList(params: {
  status?: string;
  date?: string;
  dateRange?: string; // "ALL" | "TODAY" | "YESTERDAY" | "LAST_7_DAYS" | "THIS_MONTH" | "CUSTOM"
  customDate?: string; // "YYYY-MM-DD"
  agentId?: string; // "ALL" or agent id
  search?: string;
  page?: number;
  limit?: number;
} = {}) {
  try {
    const organizationId = await getOrgId();
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    const andConditions: any[] = [{ organizationId }];

    // Status filter
    if (params.status && params.status !== "ALL") {
      andConditions.push({ status: params.status });
    }

    // Direct date match if passed
    if (params.date) {
      andConditions.push({ date: params.date });
    }

    // Search filter
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      andConditions.push({
        OR: [
          { appointmentNumber: { contains: q, mode: "insensitive" } },
          { customerName: { contains: q, mode: "insensitive" } },
          { customerPhone: { contains: q, mode: "insensitive" } },
          { serviceName: { contains: q, mode: "insensitive" } },
        ],
      });
    }

    // Date Range Presets (Today, Yesterday, Last 7 Days, This Month, Custom Date)
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    if (params.dateRange === "TODAY") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      andConditions.push({
        OR: [
          { date: todayStr },
          { createdAt: { gte: start, lte: end } },
        ],
      });
    } else if (params.dateRange === "YESTERDAY") {
      const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const start = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0, 0);
      const end = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59, 999);
      andConditions.push({
        OR: [
          { date: yesterdayStr },
          { createdAt: { gte: start, lte: end } },
        ],
      });
    } else if (params.dateRange === "LAST_7_DAYS") {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      andConditions.push({ createdAt: { gte: start } });
    } else if (params.dateRange === "THIS_MONTH") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      andConditions.push({ createdAt: { gte: start } });
    } else if (params.dateRange === "CUSTOM" && params.customDate) {
      const [year, month, day] = params.customDate.split("-").map(Number);
      const start = new Date(year, month - 1, day, 0, 0, 0, 0);
      const end = new Date(year, month - 1, day, 23, 59, 59, 999);
      andConditions.push({
        OR: [
          { date: params.customDate },
          { createdAt: { gte: start, lte: end } },
        ],
      });
    }

    // Agent filter (matches AI Agent or Assigned Team Member on contact or in notes)
    if (params.agentId && params.agentId !== "ALL") {
      andConditions.push({
        OR: [
          { contact: { aiAgentId: params.agentId } },
          { contact: { assignedAgentId: params.agentId } },
          { notes: { contains: params.agentId, mode: "insensitive" } },
        ],
      });
    }

    const where = { AND: andConditions };

    const [appointments, totalCount, statsData, aiAgents, teamMembers] = await Promise.all([
      prisma.appointment.findMany({
        where,
        orderBy: [{ date: "asc" }, { time: "asc" }],
        skip,
        take: limit,
        include: {
          contact: {
            select: {
              id: true,
              waId: true,
              name: true,
              profilePic: true,
              aiAgentId: true,
              aiAgent: { select: { id: true, name: true } },
              assignedAgentId: true,
              assignedAgent: { select: { id: true, name: true, email: true } },
            },
          },
          service: {
            select: { id: true, name: true, price: true, durationMinutes: true },
          },
        },
      }),
      prisma.appointment.count({ where }),
      prisma.appointment.findMany({
        where,
        select: { status: true, date: true },
      }),
      prisma.aIAgent.findMany({
        where: { organizationId },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: { organizationId },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
    ]);

    let confirmedCount = 0;
    let pendingCount = 0;
    let completedCount = 0;
    let todayCount = 0;

    for (const a of statsData) {
      if (a.status === "CONFIRMED") confirmedCount++;
      if (a.status === "PENDING") pendingCount++;
      if (a.status === "COMPLETED") completedCount++;
      if (a.date === todayStr) todayCount++;
    }

    const agentsList = [
      ...aiAgents.map((a) => ({ id: a.id, name: a.name, type: "AI" as const })),
      ...teamMembers.map((u) => ({ id: u.id, name: u.name || u.email, type: "USER" as const })),
    ];

    return {
      success: true,
      appointments: appointments.map((a) => ({
        ...a,
        price: Number(a.price),
      })),
      agents: agentsList,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      stats: {
        totalAppointments: statsData.length,
        confirmedCount,
        pendingCount,
        completedCount,
        todayCount,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAppointmentDetails(id: string) {
  try {
    const organizationId = await getOrgId();
    const apt = await prisma.appointment.findFirst({
      where: { id, organizationId },
      include: {
        contact: {
          select: {
            id: true,
            waId: true,
            name: true,
            profilePic: true,
            aiAgent: { select: { id: true, name: true } },
            assignedAgent: { select: { id: true, name: true, email: true } },
          },
        },
        service: true,
      },
    });

    if (!apt) return { success: false, error: "Appointment not found." };

    return {
      success: true,
      appointment: {
        ...apt,
        price: Number(apt.price),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateAppointmentStatus(
  appointmentId: string,
  status: string,
  notes?: string,
  templateOptions?: {
    templateName?: string;
    languageCode?: string;
  }
) {
  try {
    const organizationId = await getOrgId();
    const existing = await prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId },
    });

    if (!existing) return { success: false, error: "Appointment not found." };

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status,
        ...(notes ? { notes: `${existing.notes || ""}\n${notes}`.trim() } : {}),
      },
    });

    // Automatically send updated WhatsApp status message or selected Template to customer with Appointment ID
    let notificationResult: any = null;
    if (templateOptions?.templateName !== "none") {
      const { sendAppointmentStatusNotification } = await import("@/lib/whatsapp/order-notifications");
      notificationResult = await sendAppointmentStatusNotification(appointmentId, status, templateOptions).catch((err) => {
        console.error(`[updateAppointmentStatus] WhatsApp notification failed: ${err.message}`);
        return { success: false, error: err.message };
      });
    }

    revalidatePath("/dashboard/appointments");
    return { success: true, appointment: updated, notification: notificationResult };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkUpdateAppointmentStatus(
  appointmentIds: string[],
  status: string,
  templateOptions?: {
    templateName?: string;
    languageCode?: string;
  }
) {
  try {
    const organizationId = await getOrgId();
    if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return { success: false, error: "No appointments selected." };
    }

    const updated = await prisma.appointment.updateMany({
      where: {
        id: { in: appointmentIds },
        organizationId,
      },
      data: {
        status,
      },
    });

    // Automatically send WhatsApp status notifications or selected Template to all selected appointments
    const { sendAppointmentStatusNotification } = await import("@/lib/whatsapp/order-notifications");
    Promise.allSettled(appointmentIds.map((id) => sendAppointmentStatusNotification(id, status, templateOptions))).catch((err) => {
      console.error(`[bulkUpdateAppointmentStatus] WhatsApp notification failed: ${err.message}`);
    });

    revalidatePath("/dashboard/appointments");
    return { success: true, count: updated.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rescheduleAppointmentAction(
  appointmentId: string,
  date: string,
  time: string,
  templateOptions?: {
    templateName?: string;
    languageCode?: string;
  }
) {
  try {
    const organizationId = await getOrgId();
    const existing = await prisma.appointment.findFirst({
      where: { id: appointmentId, organizationId },
    });

    if (!existing) return { success: false, error: "Appointment not found." };

    // Collision check
    const collision = await prisma.appointment.findFirst({
      where: {
        organizationId,
        id: { not: appointmentId },
        date: date.trim(),
        time: time.trim(),
        status: { in: ["CONFIRMED", "PENDING"] },
      },
    });

    if (collision) {
      return { success: false, error: `Slot ${time} on ${date} is already booked.` };
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        date: date.trim(),
        time: time.trim(),
        status: "CONFIRMED",
      },
    });

    // Automatically send reschedule WhatsApp notification to customer with Appointment ID
    const { sendAppointmentStatusNotification } = await import("@/lib/whatsapp/order-notifications");
    sendAppointmentStatusNotification(appointmentId, "RESCHEDULED", templateOptions).catch((err) => {
      console.error(`[rescheduleAppointmentAction] WhatsApp notification failed: ${err.message}`);
    });

    revalidatePath("/dashboard/appointments");
    return { success: true, appointment: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteAppointment(appointmentId: string) {
  try {
    const organizationId = await getOrgId();
    await prisma.appointment.delete({
      where: { id: appointmentId, organizationId },
    });
    revalidatePath("/dashboard/appointments");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function bulkDeleteAppointments(appointmentIds: string[]) {
  try {
    const organizationId = await getOrgId();
    if (!appointmentIds || !Array.isArray(appointmentIds) || appointmentIds.length === 0) {
      return { success: false, error: "No appointments selected." };
    }

    const deleted = await prisma.appointment.deleteMany({
      where: {
        id: { in: appointmentIds },
        organizationId,
      },
    });

    revalidatePath("/dashboard/appointments");
    return { success: true, count: deleted.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createManualAppointment(data: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  serviceId?: string;
  serviceName: string;
  staffName?: string;
  date: string;
  time: string;
  durationMinutes?: number;
  price?: number;
  notes?: string;
}) {
  try {
    const organizationId = await getOrgId();
    const appointmentNumber = generateAppointmentNumber();

    const appointment = await prisma.appointment.create({
      data: {
        appointmentNumber,
        organizationId,
        serviceId: data.serviceId || null,
        serviceName: data.serviceName.trim(),
        customerName: data.customerName.trim(),
        customerPhone: data.customerPhone.trim(),
        customerEmail: data.customerEmail?.trim() || null,
        staffName: data.staffName?.trim() || null,
        date: data.date.trim(),
        time: data.time.trim(),
        durationMinutes: Number(data.durationMinutes) || 30,
        price: Number(data.price) || 0,
        currency: "PKR",
        status: "CONFIRMED",
        notes: data.notes || null,
        source: "MANUAL",
      },
    });

    // Send WhatsApp confirmation to customer with Appointment ID
    const { sendAppointmentStatusNotification } = await import("@/lib/whatsapp/order-notifications");
    sendAppointmentStatusNotification(appointment.id, "CONFIRMED").catch((err) => {
      console.error(`[createManualAppointment] WhatsApp notification failed: ${err.message}`);
    });

    revalidatePath("/dashboard/appointments");
    return { success: true, appointment };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
