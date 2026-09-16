'use server';

import { getServerSession } from'next-auth';
import { authOptions } from'@/lib/auth';
import { prisma } from'@/lib/prisma';
import { hashPassword } from'@/lib/auth-utils';
import { revalidatePath } from'next/cache';
import { getPusherServer } from '@/lib/pusher';
import { logger } from '@/lib/logger';
import { logActivity } from '@/lib/activityLog';
import { checkQuota } from '@/lib/quota';

/**
 * DEPARTMENTS
 */

export async function getDepartments() {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) return [];

 return await prisma.department.findMany({
 where: { organizationId: session.user.organizationId },
 include: {
 _count: {
 select: { users: true }
 }
 },
 orderBy: { createdAt:'desc' }
 });
}

export async function createDepartment(name: string) {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) throw new Error('Unauthorized');

 const department = await prisma.department.create({
 data: {
 name,
 organizationId: session.user.organizationId
 }
 });

  revalidatePath('/manage/agents');
 return department;
}

export async function updateDepartment(id: string, name: string) {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) throw new Error('Unauthorized');

 const department = await prisma.department.update({
 where: {
 id,
 organizationId: session.user.organizationId
 },
 data: { name }
 });

  revalidatePath('/manage/agents');
 return department;
}

export async function deleteDepartment(id: string) {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) throw new Error('Unauthorized');

 // Any users in this department will have their departmentId set to null (SetNull in schema)
 await prisma.department.delete({
 where: {
 id,
 organizationId: session.user.organizationId
 }
 });

  revalidatePath('/manage/agents');
 return { success: true };
}

/**
 * AGENTS (USERS)
 */

export async function getAgents() {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) return [];

 return await prisma.user.findMany({
 where: {
 organizationId: session.user.organizationId,
 role: { not:'SUPER_ADMIN' } // Usually we don't list super admins in the agent directory
 },
 include: {
 department: true,
 deviceSettings: {
 orderBy: { lastActiveAt: 'desc' },
 take: 1
 }
 },
 orderBy: { createdAt:'desc' }
 });
}

export async function createAgent(formData: any) {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) throw new Error('Unauthorized');

  const { name, email, password, departmentName, permissions } = formData;

  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new Error('Name is required');
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new Error('Email is required');
  }

  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }

  // Check quota
  const quota = await checkQuota(session.user.organizationId, 'maxTeamMembers');
  if (!quota.allowed) {
    throw new Error(quota.message);
  }

 // 1. Check if user already exists
 const cleanEmail = email.trim().toLowerCase();
 const existingUser = await prisma.user.findUnique({
 where: { email: cleanEmail }
 });

 if (existingUser) {
 throw new Error('User with this email already exists');
 }

 // 2. Hash password
 const hashedPassword = await hashPassword(password);

 // 3. Find department if provided
 let departmentId = null;
 if (departmentName) {
 const department = await prisma.department.findFirst({
 where: {
 name: departmentName,
 organizationId: session.user.organizationId
 }
 });
 departmentId = department?.id;
 }

 // 4. Create User
 const user = await prisma.user.create({
 data: {
 name: name.trim(),
 email: cleanEmail,
 password: hashedPassword,
 role:'USER',
 status:'ACTIVE',
 organizationId: session.user.organizationId,
 departmentId,
 permissions,
 onboardingCompleted: true // Agents don't need onboarding
 }
 });

  revalidatePath('/manage/agents'); await triggerSessionUpdate(user.id);
  logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Created',
    module: 'Agents',
    target: name,
    details: 'Email: ' + email,
    status: 'success',
  });
 return user;
}

export async function updateAgent(id: string, formData: any) {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) throw new Error('Unauthorized');

 const { name, email, password, departmentName, permissions, status, role } = formData;

 const data: any = {
 permissions,
 status
 };
 if (name && typeof name === 'string') data.name = name.trim();
 if (email && typeof email === 'string') data.email = email.trim().toLowerCase();
 if (role && typeof role === 'string') {
   const sanitizedRole = role.toUpperCase();
   if (sanitizedRole === 'SUPER_ADMIN') {
     throw new Error('Unauthorized role assignment');
   }
   const allowedRoles = ['ADMIN', 'MANAGER', 'USER', 'AGENT', 'GUEST', 'VIEWER'];
   if (allowedRoles.includes(sanitizedRole)) {
     data.role = sanitizedRole === 'AGENT' ? 'USER' : (sanitizedRole === 'VIEWER' ? 'GUEST' : sanitizedRole);
   }
 }

 if (password) {
 if (typeof password !== 'string' || password.length < 8) {
   throw new Error('Password must be at least 8 characters long');
 }
 data.password = await hashPassword(password);
 }

 if (departmentName) {
 const department = await prisma.department.findFirst({
 where: {
 name: departmentName,
 organizationId: session.user.organizationId
 }
 });
 data.departmentId = department?.id || null;
 }

 const user = await prisma.user.update({
 where: {
 id,
 organizationId: session.user.organizationId
 },
 data
 });

  revalidatePath('/manage/agents'); await triggerSessionUpdate(user.id);
  logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Updated',
    module: 'Agents',
    target: name || 'Agent ID: ' + id,
    status: 'success',
  });
 return user;
}

export async function deleteAgent(id: string) {
 const session = await getServerSession(authOptions);
 if (!session?.user?.organizationId) throw new Error('Unauthorized');

 await prisma.user.delete({
 where: {
 id,
 organizationId: session.user.organizationId
 }
 });

  revalidatePath('/manage/agents'); await triggerSessionUpdate(id);
  logActivity({
    organizationId: session.user.organizationId!,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted',
    module: 'Agents',
    target: `Agent ID: ${id}`,
    status: 'success',
  });
 return { success: true };
}

async function triggerSessionUpdate(userId: string) {
  try {
    const systemConfig = await prisma.systemConfig.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        pusherAppId: true,
        pusherKey: true,
        pusherSecret: true,
        pusherCluster: true,
      },
    });

    if (
      systemConfig?.pusherAppId &&
      systemConfig?.pusherKey &&
      systemConfig?.pusherSecret &&
      systemConfig?.pusherCluster
    ) {
      const pusher = getPusherServer({
        appId: systemConfig.pusherAppId,
        key: systemConfig.pusherKey,
        secret: systemConfig.pusherSecret,
        cluster: systemConfig.pusherCluster,
      });
      await pusher.trigger(`user-${userId}`, 'session-update', {
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.general.warn('SessionUpdate', `Failed to trigger Pusher event: ${String(error)}`);
  }
}
