'use server';

import { prisma } from'@/lib/prisma';
import { getServerSession } from'next-auth';
import { authOptions } from'@/lib/auth';
import { logActivity } from '@/lib/activityLog';
/**
 * Fetches all organizations owned by the user.
 * Also performs a silent backfill if the user's current organization
 * doesn't have an ownerId set (for legacy data migration).
 */
export async function getAvailableProjects() {
 try {
 const session = await getServerSession(authOptions);
 if (!session?.user?.id) return { success: false, error:'Unauthorized' };

 // 1. Silent Backfill (migration)
 if (session.user.organizationId) {
 const currentOrg = await prisma.organization.findUnique({
 where: { id: session.user.organizationId },
 select: { id: true, ownerId: true }
 });
 if (currentOrg && !currentOrg.ownerId) {
 await prisma.organization.update({
 where: { id: currentOrg.id },
 data: { ownerId: session.user.id }
 });
 }
 }

 // 2. Fetch Projects
 const projects = await prisma.organization.findMany({
 where: { ownerId: session.user.id },
 orderBy: { createdAt:'asc' }
 });
 
 return { success: true, data: projects };
 } catch (error: any) {
 console.error('[getAvailableProjects] Error:', error);
 return { success: false, error: error.message ||'Failed to fetch projects' };
 }
}

/**
 * Creates a new blank project (Organization) and automatically switches the active user to it.
 */
export async function createNewProject(name: string) {
 try {
 const session = await getServerSession(authOptions);
 if (!session?.user?.id) return { success: false, error:'Unauthorized' };

 // Ensure name is valid
 if (!name || name.trim().length === 0) {
 return { success: false, error:'Project name is required' };
 }

 // Generate a unique slug
 let baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)+/g,'');
 if (!baseSlug) baseSlug ='project';
 let slug = baseSlug;
 
 let counter = 1;
 while (true) {
 const existing = await prisma.organization.findUnique({ where: { slug } });
 if (!existing) break;
 slug =`${baseSlug}-${counter}`;
 counter++;
 }

 // Create the new organization
 const newOrg = await prisma.organization.create({
 data: {
 name: name.trim(),
 slug,
 ownerId: session.user.id
 }
 });

 // Switch to new project automatically
 await prisma.user.update({
 where: { id: session.user.id },
 data: { organizationId: newOrg.id }
 });

 return { success: true, data: newOrg };
 } catch (error: any) {
 console.error('[createNewProject] Error:', error);
 return { success: false, error: error.message ||'Failed to create project' };
 }
}

/**
 * Switches the active organization context for the user.
 */
export async function switchProject(organizationId: string) {
 try {
 const session = await getServerSession(authOptions);
 if (!session?.user?.id) return { success: false, error:'Unauthorized' };

 // Verify ownership to ensure security
 const org = await prisma.organization.findUnique({
 where: { id: organizationId },
 select: { id: true, ownerId: true }
 });

 if (!org || org.ownerId !== session.user.id) {
 return { success: false, error:'Project not found or unauthorized' };
 }

 await prisma.user.update({
 where: { id: session.user.id },
 data: { organizationId }
 });

 return { success: true };
 } catch (error: any) {
 console.error('[switchProject] Error:', error);
 return { success: false, error: error.message ||'Failed to switch project' };
 }
}

/**
 * Deletes a project (Organization). Prevents deletion if it's the user's only project.
 * Automatically switches to another project if the active one is deleted.
 */
export async function deleteProject(organizationId: string) {
 try {
 const session = await getServerSession(authOptions);
 if (!session?.user?.id) return { success: false, error:'Unauthorized' };

 // Verify ownership
 const org = await prisma.organization.findUnique({
 where: { id: organizationId },
 select: { id: true, ownerId: true }
 });

 if (!org || org.ownerId !== session.user.id) {
 return { success: false, error:'Project not found or unauthorized' };
 }

 // Prevent deleting the very last project
 const count = await prisma.organization.count({ where: { ownerId: session.user.id } });
 if (count <= 1) {
 return { success: false, error:'You cannot delete your only profile. Create a new one first.' };
 }

 // Delete the organization
 // (Assuming Cascade delete handles related records like contacts, templates, etc.)
 await prisma.organization.delete({
 where: { id: organizationId }
 });

 // If the user's active session is on the deleted project, switch them to another available project
 if (session.user.organizationId === organizationId) {
 const firstOrg = await prisma.organization.findFirst({
 where: { ownerId: session.user.id }
 });
 if (firstOrg) {
 await prisma.user.update({
 where: { id: session.user.id },
 data: { organizationId: firstOrg.id }
 });
 }
 }

  await logActivity({
    organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted',
    module: 'Projects',
    target: `Project ID: ${organizationId}`,
    status: 'success'
  }).catch(() => {});

  return { success: true };
 } catch (error: any) {
 console.error('[deleteProject] Error:', error);
 return { success: false, error: error.message ||'Failed to delete project' };
 }
}

/**
 * Renames an existing project.
 */
export async function renameProject(organizationId: string, newName: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return { success: false, error: 'Unauthorized' };

    if (!newName || newName.trim().length === 0) {
      return { success: false, error: 'Project name is required' };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, ownerId: true }
    });

    if (!org || org.ownerId !== session.user.id) {
      return { success: false, error: 'Project not found or unauthorized' };
    }

    const updated = await prisma.organization.update({
      where: { id: organizationId },
      data: { name: newName.trim() }
    });

    return { success: true, data: updated };
  } catch (error: any) {
    console.error('[renameProject] Error:', error);
    return { success: false, error: error.message || 'Failed to rename project' };
  }
}
