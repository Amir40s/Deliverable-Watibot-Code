"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

async function getOrgId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized");
  }
  return session.user.organizationId;
}

// ─── Business Profile (General Info & Rules) ──────────────────────────────────

export async function getBusinessProfileData() {
  try {
    const organizationId = await getOrgId();
    let profile = await prisma.businessProfile.findUnique({
      where: { organizationId },
    });

    if (!profile) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true, businessDescription: true },
      });

      profile = await prisma.businessProfile.create({
        data: {
          organizationId,
          storeName: org?.name || "My Business",
          description: org?.businessDescription || "",
          currency: "PKR",
          deliveryCharges: 0,
          deliveryTime: "2-4 working days",
          workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
          openingTime: "09:00",
          closingTime: "18:00",
          slotDuration: 30,
        },
      });
    }

    return {
      success: true,
      profile: {
        ...profile,
        deliveryCharges: Number(profile.deliveryCharges || 0),
        faqs: Array.isArray(profile.faqs) ? (profile.faqs as any[]) : [],
        paymentMethods: profile.paymentMethods || ["Cash on Delivery", "Bank Transfer"],
        workingDays: profile.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        staffMembers: profile.staffMembers || [],
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateBusinessProfileData(data: {
  storeName?: string;
  businessType?: string;
  description?: string;
  currency?: string;
  deliveryCharges?: number;
  deliveryAreas?: string;
  deliveryTime?: string;
  paymentMethods?: string[];
  returnPolicy?: string;
  faqs?: Array<{ question: string; answer: string }>;
  customInstructions?: string;
  workingDays?: string[];
  openingTime?: string;
  closingTime?: string;
  slotDuration?: number;
  bookingRules?: string;
  appointmentPolicies?: string;
  staffMembers?: string[];
}) {
  try {
    const organizationId = await getOrgId();

    const updated = await prisma.businessProfile.upsert({
      where: { organizationId },
      update: {
        storeName: data.storeName,
        businessType: data.businessType || "hybrid",
        description: data.description,
        currency: data.currency || "PKR",
        deliveryCharges: data.deliveryCharges !== undefined ? data.deliveryCharges : 0,
        deliveryAreas: data.deliveryAreas,
        deliveryTime: data.deliveryTime,
        paymentMethods: data.paymentMethods || ["Cash on Delivery"],
        returnPolicy: data.returnPolicy,
        faqs: data.faqs || [],
        customInstructions: data.customInstructions,
        workingDays: data.workingDays || [],
        openingTime: data.openingTime || "09:00",
        closingTime: data.closingTime || "18:00",
        slotDuration: data.slotDuration || 30,
        bookingRules: data.bookingRules,
        appointmentPolicies: data.appointmentPolicies,
        staffMembers: data.staffMembers || [],
      },
      create: {
        organizationId,
        storeName: data.storeName || "My Business",
        businessType: data.businessType || "hybrid",
        description: data.description,
        currency: data.currency || "PKR",
        deliveryCharges: data.deliveryCharges !== undefined ? data.deliveryCharges : 0,
        deliveryAreas: data.deliveryAreas,
        deliveryTime: data.deliveryTime || "2-4 working days",
        paymentMethods: data.paymentMethods || ["Cash on Delivery"],
        returnPolicy: data.returnPolicy,
        faqs: data.faqs || [],
        customInstructions: data.customInstructions,
        workingDays: data.workingDays || ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        openingTime: data.openingTime || "09:00",
        closingTime: data.closingTime || "18:00",
        slotDuration: data.slotDuration || 30,
        bookingRules: data.bookingRules,
        appointmentPolicies: data.appointmentPolicies,
        staffMembers: data.staffMembers || [],
      },
    });

    revalidatePath("/dashboard/business-knowledge");
    return { success: true, profile: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Products & Catalog Management ───────────────────────────────────────────

export async function getBusinessProducts(category?: string, search?: string) {
  try {
    const organizationId = await getOrgId();
    const where: any = { organizationId };

    if (category && category !== "ALL") {
      where.category = category;
    }
    if (search && search.trim()) {
      where.OR = [
        { name: { contains: search.trim(), mode: "insensitive" } },
        { description: { contains: search.trim(), mode: "insensitive" } },
        { sku: { contains: search.trim(), mode: "insensitive" } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      products: products.map((p) => ({
        ...p,
        price: Number(p.price),
        variants: Array.isArray(p.variants) ? (p.variants as any[]) : [],
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function saveBusinessProduct(data: {
  id?: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  category?: string;
  sku?: string;
  imageUrl?: string;
  stock?: number;
  variants?: Array<{
    id?: string;
    name: string;
    size?: string;
    color?: string;
    price?: number;
    stock?: number;
    sku?: string;
  }>;
  isAvailable?: boolean;
}) {
  try {
    const organizationId = await getOrgId();

    if (!data.name?.trim()) {
      return { success: false, error: "Product name is required." };
    }

    const payload = {
      name: data.name.trim(),
      description: data.description || null,
      price: data.price || 0,
      currency: data.currency || "PKR",
      category: data.category?.trim() || "General",
      sku: data.sku?.trim() || null,
      imageUrl: data.imageUrl?.trim() || null,
      stock: data.stock !== undefined ? Number(data.stock) : 100,
      variants: data.variants || [],
      isAvailable: data.isAvailable !== false,
      status: "active",
      platform: "manual",
    };

    let product;
    if (data.id) {
      product = await prisma.product.update({
        where: { id: data.id, organizationId },
        data: payload,
      });
    } else {
      product = await prisma.product.create({
        data: {
          ...payload,
          organizationId,
        },
      });
    }

    revalidatePath("/dashboard/business-knowledge");
    return {
      success: true,
      product: {
        ...product,
        price: Number(product.price),
        variants: Array.isArray(product.variants) ? (product.variants as any[]) : [],
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteBusinessProduct(id: string) {
  try {
    const organizationId = await getOrgId();
    await prisma.product.delete({
      where: { id, organizationId },
    });
    revalidatePath("/dashboard/business-knowledge");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── Business Services Management ─────────────────────────────────────────────

export async function getBusinessServicesList() {
  try {
    const organizationId = await getOrgId();
    const services = await prisma.businessService.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      services: services.map((s) => ({
        ...s,
        price: Number(s.price),
      })),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function saveBusinessService(data: {
  id?: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  durationMinutes?: number;
  staff?: string;
  category?: string;
  isActive?: boolean;
}) {
  try {
    const organizationId = await getOrgId();

    if (!data.name?.trim()) {
      return { success: false, error: "Service name is required." };
    }

    const payload = {
      name: data.name.trim(),
      description: data.description || null,
      price: data.price || 0,
      currency: data.currency || "PKR",
      durationMinutes: data.durationMinutes || 30,
      staff: data.staff?.trim() || null,
      category: data.category?.trim() || "General",
      isActive: data.isActive !== false,
    };

    let service;
    if (data.id) {
      service = await prisma.businessService.update({
        where: { id: data.id, organizationId },
        data: payload,
      });
    } else {
      service = await prisma.businessService.create({
        data: {
          ...payload,
          organizationId,
        },
      });
    }

    revalidatePath("/dashboard/business-knowledge");
    return {
      success: true,
      service: {
        ...service,
        price: Number(service.price),
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteBusinessService(id: string) {
  try {
    const organizationId = await getOrgId();
    await prisma.businessService.delete({
      where: { id, organizationId },
    });
    revalidatePath("/dashboard/business-knowledge");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
