'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { hashPassword, verifyPassword } from "@/lib/auth-utils";
import { logActivity } from "@/lib/activityLog";

export async function getUserProfile() {
 const session = await getServerSession(authOptions);

 console.log("getUserProfile called. Session:", session?.user?.email);

 if (!session?.user?.email) {
 console.error("Unauthorized: No session email");
 throw new Error("Unauthorized");
 }

 const user = await prisma.user.findUnique({
 where: { email: session.user.email },
 select: {
 name: true,
 email: true,
 phoneNumber: true,
 image: true,
 organization: {
 select: {
 whatsappNumber: true
 }
 }
 }
 });

 if (!user) {
 throw new Error("User not found");
 }

 // Fallback to organization whatsapp number if user phone is missing
 const phoneNumber = user.phoneNumber || user.organization?.whatsappNumber || "";

 // Split name into first and last name for frontend form
 const nameParts = (user.name || "").split(" ");
 const firstName = nameParts[0] || "";
 const lastName = nameParts.slice(1).join(" ") || "";

 return {
 ...user,
 phoneNumber,
 firstName,
 lastName
 };
}

export async function updateUserProfile(formData: {
 firstName: string;
 lastName: string;
 email: string;
 phoneNumber: string;
 currentPassword?: string;
 password?: string;
}) {
 const session = await getServerSession(authOptions);

 if (!session?.user?.email) {
 throw new Error("Unauthorized");
 }

 // Combine first and last name
 const name =`${formData.firstName} ${formData.lastName}`.trim();

 try {
 const user = await prisma.user.findUnique({
 where: { email: session.user.email },
 select: { id: true, password: true }
 });

 if (!user) throw new Error("User not found");

 // 1. If email is changing, check for uniqueness
 if (formData.email !== session.user.email) {
 const existingUser = await prisma.user.findUnique({
 where: { email: formData.email },
 select: { id: true }
 });

 if (existingUser) {
 return { success: false, error: "Email address is already in use by another account" };
 }
 }

 const updateData: Record<string, unknown> = {
 name,
 email: formData.email,
 phoneNumber: formData.phoneNumber
 };

 // 2. Handle Password update
 if (formData.password) {
 if (!formData.currentPassword) {
 return { success: false, error: "Current password is required to set a new password" };
 }

 // Verify current password
 const isPasswordValid = await verifyPassword(formData.currentPassword, user.password || "");
 if (!isPasswordValid) {
 return { success: false, error: "The current password you entered is incorrect" };
 }

 updateData.password = await hashPassword(formData.password);
 }

 await prisma.user.update({
 where: { id: user.id },
 data: updateData
 });

 revalidatePath('/admin/profile');
 revalidatePath('/profile');

 await logActivity({
   organizationId: session.user.organizationId!,
   userId: session.user.id!,
   userEmail: session.user.email!,
   userName: session.user.name!,
   action: 'Updated',
   module: 'System',
   target: 'User Profile',
   status: 'success'
 });

 return { success: true };
 } catch (error) {
 console.error("Failed to update profile:", error);
 return { success: false, error: "An unexpected error occurred while saving your profile" };
 }
}

export async function updateUserAvatar(imageUrl: string) {
 const session = await getServerSession(authOptions);

 if (!session?.user?.email) {
 throw new Error("Unauthorized");
 }

 try {
 await prisma.user.update({
 where: { email: session.user.email },
 data: { image: imageUrl }
 });

 revalidatePath('/profile');
 revalidatePath('/admin/profile');

 await logActivity({
   organizationId: session.user.organizationId!,
   userId: session.user.id!,
   userEmail: session.user.email!,
   userName: session.user.name!,
   action: 'Updated',
   module: 'System',
   target: 'User Avatar',
   status: 'success'
 });

 return { success: true };
 } catch (error) {
 console.error("Failed to update avatar:", error);
 return { success: false, error: "Failed to update profile picture" };
 }
}
