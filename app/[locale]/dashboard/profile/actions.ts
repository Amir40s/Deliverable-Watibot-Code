"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseDescription, mergeDescription } from "@/lib/profile";

export type MetaProfileData = {
 businessAddress?: string | null;
 businessDescription?: string | null;
 businessEmail?: string | null;
 businessLogo?: string | null;
 businessVertical?: string | null;
 businessWebsites?: string[];
 whatsappBusinessName?: string | null;
};

export type UpdateMetaProfileResult = { success: true } | { success: false; error: string };

export async function updateProfile(formData: {
 name?: string | null;
 email?: string | null;
 image?: string | null;
}): Promise<UpdateMetaProfileResult> {
 const session = await getServerSession(authOptions);
 if (!session?.user?.id) {
 return { success: false, error: "Not authenticated." };
 }

 const { name, image } = formData;
 if (name !== undefined && (typeof name !== "string" || name.trim().length === 0)) {
 return { success: false, error: "Name cannot be empty." };
 }

 try {
 await prisma.user.update({
 where: { id: session.user.id },
 data: {
 ...(name !== undefined && { name: name?.trim() || null }),
 ...(image !== undefined && { image: image?.trim() || null }),
 ...(formData.email && { email: formData.email.trim() }),
 },
 });
 revalidatePath("/dashboard/meta-profile");
 return { success: true };
 } catch (e) {
 console.error("Profile update failed:", e);
 return { success: false, error: "Failed to update profile." };
 }
}

export async function updateOrganizationName(name: string): Promise<UpdateMetaProfileResult> {
 const session = await getServerSession(authOptions);
 if (!session?.user?.id) {
 return { success: false, error: "Not authenticated." };
 }
 if (!session.user.organizationId) {
 return { success: false, error: "No organization linked to this account." };
 }

 const trimmed = name?.trim();
 if (!trimmed) {
 return { success: false, error: "Organization name cannot be empty." };
 }

 try {
 await prisma.organization.update({
 where: { id: session.user.organizationId },
 data: { name: trimmed },
 });
 revalidatePath("/dashboard/meta-profile");
 return { success: true };
 } catch (e) {
 console.error("Organization name update failed:", e);
 return { success: false, error: "Failed to update organization name." };
 }
}

export async function getMetaProfile() {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) {
 return null;
 }

 const org = await prisma.organization.findUnique({
 where: { id: session.user.organizationId },
 select: {
 businessAddress: true,
 businessDescription: true,
 businessEmail: true,
 businessLogo: true, // Fetch logo
 businessVertical: true,
 businessWebsites: true,
 whatsappBusinessName: true,
 },
 });

 if (!org) return null;

 return {
 ...org,
 businessDescription: parseDescription(org.businessDescription),
 businessWebsites: Array.isArray(org.businessWebsites) ? (org.businessWebsites as string[]) : [],
 };
}

export async function updateMetaProfile(data: MetaProfileData): Promise<UpdateMetaProfileResult> {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) {
 return { success: false, error: "Not authenticated or no organization selected." };
 }

 try {
  const existingOrg = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { businessDescription: true }
  });

  const updatedDescription = mergeDescription(existingOrg?.businessDescription, data.businessDescription);

 await prisma.organization.update({
 where: { id: session.user.organizationId },
 data: {
 businessAddress: data.businessAddress,
 businessDescription: updatedDescription,
 businessEmail: data.businessEmail,
 businessLogo: data.businessLogo, // Update logo
 businessVertical: data.businessVertical,
 businessWebsites: data.businessWebsites, // Prisma handles string[] -> Json automatically
 whatsappBusinessName: data.whatsappBusinessName,
 },
 });

 revalidatePath("/dashboard/profile");
 return { success: true };
 } catch (e) {
 console.error("Meta Profile update failed:", e);
 if (e instanceof Error) {
 console.error("Error message:", e.message);
 console.error("Error stack:", e.stack);
 }
 return { success: false, error: "Failed to update Meta Profile." };
 }
}
