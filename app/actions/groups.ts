
'use server';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { logActivity } from '@/lib/activityLog';
import { randomUUID } from 'crypto';
import { checkQuota } from '@/lib/quota';



function normalizeGroupName(name: string) {
  return name.trim() || `Group ${new Date().toLocaleDateString()}`;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

async function getUniqueGroupName(organizationId: string, requestedName: string) {
  const baseName = normalizeGroupName(requestedName);
  const existingGroups = await prisma.contactGroup.findMany({
    where: {
      organizationId,
      OR: [
        { name: baseName },
        { name: { startsWith: `${baseName} (` } }
      ]
    },
    select: { name: true }
  });

  const existingNames = new Set(existingGroups.map((group) => group.name));
  if (!existingNames.has(baseName)) return baseName;

  for (let index = 2; index < 1000; index++) {
    const candidate = `${baseName} (${index})`;
    if (!existingNames.has(candidate)) return candidate;
  }

  return `${baseName} (${Date.now().toString(36)})`;
}

// --- CREATE Group ---
export async function createGroup(data: {
  name: string;
  description?: string;
  color?: string;
  contactIds?: string[];
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  const organizationId = session.user.organizationId;
  const contactIds = Array.from(new Set(data.contactIds || []));
  const createWithName = (name: string) => prisma.contactGroup.create({
    data: {
      organizationId,
      name,
      description: data.description,
      color: data.color || '#00B074',
      contacts: contactIds.length > 0 ? {
        createMany: {
          data: contactIds.map(contactId => ({
            contactId
          }))
        }
      } : undefined
    }
  });

  let group;
  try {
    group = await createWithName(await getUniqueGroupName(organizationId, data.name));
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    group = await createWithName(`${normalizeGroupName(data.name)} (${Date.now().toString(36)})`);
  }

  revalidatePath('/dashboard/contacts');

  await logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Created',
    module: 'Contacts',
    target: `Group: ${group.name}`,
    status: 'success'
  });

  return { success: true, group };
}

// --- READ Groups ---
export async function getGroups() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) return { groups: [] };

  const groups = await prisma.contactGroup.findMany({
    where: {
      organizationId: session.user.organizationId,
    },
    include: {
      _count: {
        select: { contacts: true }
      }
    },
    orderBy: { name: 'asc' }
  });

  return { groups };
}

// --- UPDATE Group ---
export async function updateGroup(groupId: string, data: {
  name?: string;
  description?: string;
  color?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  // Ensure group belongs to org
  const existing = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId: session.user.organizationId }
  });
  if (!existing) throw new Error('Group not found');

  await prisma.contactGroup.update({
    where: { id: groupId },
    data: {
      ...data
    }
  });

  revalidatePath('/dashboard/contacts');
  return { success: true };
}

// --- DELETE Group ---
export async function deleteGroup(groupId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  // Find name before delete for logging
  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId: session.user.organizationId }
  });

  if (group) {
    await prisma.contactGroup.deleteMany({
      where: {
        id: groupId,
        organizationId: session.user.organizationId
      }
    });

    await logActivity({
      organizationId: session.user.organizationId,
      userId: session.user.id,
      userEmail: session.user.email,
      userName: session.user.name,
      action: 'Deleted',
      module: 'Contacts',
      target: `Group: ${group.name}`,
      status: 'success'
    });
  }

  revalidatePath('/dashboard/contacts');
  return { success: true };
}

// --- Add Contacts to Group ---
export async function addContactsToGroup(groupId: string, contactIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  // Verify group belongs to org
  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId: session.user.organizationId }
  });
  if (!group) throw new Error('Group not found');

  // Create memberships (ignore duplicates)
  await prisma.contactGroupMember.createMany({
    data: contactIds.map(contactId => ({
      groupId,
      contactId
    })),
    skipDuplicates: true
  });

  revalidatePath('/dashboard/contacts');
  return { success: true };
}

// --- Remove Contact from Group ---
export async function removeContactFromGroup(groupId: string, contactId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  await prisma.contactGroupMember.deleteMany({
    where: {
      groupId,
      contactId
    }
  });

  logActivity({
    organizationId: session.user.organizationId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    action: 'Deleted',
    module: 'Groups',
    target: `Removed Contact ${contactId} from Group ${groupId}`,
    status: 'success'
  }).catch(() => { });

  revalidatePath('/dashboard/contacts');
  return { success: true };
}

// --- Get Contacts in a Group ---
export async function getGroupContacts(groupId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  const members = await prisma.contactGroupMember.findMany({
    where: {
      groupId,
      group: {
        organizationId: session.user.organizationId
      }
    },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          waId: true,
          email: true,
          profilePic: true
        }
      }
    },
    orderBy: {
      contact: {
        name: 'asc'
      }
    }
  });

  return members.map(m => m.contact);
}

// --- Add Contact by Phone Number directly to Group ---
export async function addNumberToGroup(groupId: string, phoneNumber: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  const cleanNumber = phoneNumber.replace(/\D/g, '');
  if (cleanNumber.length < 8) throw new Error('Invalid phone number length');

  // Find or create the contact
  let contact = await prisma.contact.findFirst({
    where: {
      organizationId: session.user.organizationId,
      waId: cleanNumber
    }
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        organizationId: session.user.organizationId,
        waId: cleanNumber,
        name: `+${cleanNumber}`,
        isAutoCreated: false,
        lastMessageAt: new Date()
      }
    });
  } else {
    // If it was auto-created, promote it to a regular CRM contact
    if (contact.isAutoCreated) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { isAutoCreated: false }
      });
    }
  }

  await prisma.contactGroupMember.upsert({
    where: {
      contactId_groupId: {
        contactId: contact.id,
        groupId
      }
    },
    update: {},
    create: {
      groupId,
      contactId: contact.id
    }
  });

  revalidatePath('/dashboard/contacts');
  return { success: true, contact };
}

// --- Bulk Add Contacts from Import directly to Group ---
export async function bulkImportContactsToGroup(groupId: string, contacts: Array<{
  name: string;
  phoneNumber: string;
  email?: string;
  notes?: string;
  customAttributes?: Record<string, string>;
}>, tagIds?: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) throw new Error('Unauthorized');

  // Verify group belongs to org
  const group = await prisma.contactGroup.findFirst({
    where: { id: groupId, organizationId: session.user.organizationId }
  });
  if (!group) throw new Error('Group not found');

  // Quota Check (Initial)
  const quota = await checkQuota(session.user.organizationId, 'maxContacts');
  if (!quota.allowed) {
    return {
      success: false,
      error: quota.message
    };
  }

  let createdCount = 0;
  const errors: string[] = [];

  // Clean phone numbers
  const cleanedContacts = contacts.map(c => {
    const waId = c.phoneNumber.replace(/\D/g, '');
    return {
      ...c,
      waId
    };
  }).filter(c => c.waId.length >= 7);

  const waIds = cleanedContacts.map(c => c.waId);

  // We will need to collect all contact IDs (both existing and new) to add to the group
  const contactIdsToGroup: string[] = [];

  try {
    // 1. Fetch existing contacts in ONE query
    const existingContacts = await prisma.contact.findMany({
      where: {
        organizationId: session.user.organizationId,
        waId: { in: waIds }
      }
    });

    const existingMap = new Map(existingContacts.map(c => [c.waId, c]));

    const toCreate: any[] = [];
    const toUpdate: any[] = [];

    for (const c of cleanedContacts) {
      const existing = existingMap.get(c.waId);
      if (existing) {
        toUpdate.push({
          id: existing.id,
          name: c.name && c.name !== 'Imported Contact' ? c.name : existing.name,
          email: c.email || existing.email,
          notes: c.notes ? `${existing.notes || ''}\n${c.notes}`.trim() : existing.notes,
          ...(c.customAttributes ? { customAttributes: c.customAttributes } : {})
        });
        contactIdsToGroup.push(existing.id);
      } else {
        const newId = randomUUID();
        toCreate.push({
          id: newId,
          organizationId: session.user.organizationId,
          waId: c.waId,
          name: c.name || `+${c.waId}`,
          email: c.email || null,
          notes: c.notes || '',
          isAutoCreated: false,
          lastMessageAt: new Date(),
          ...(c.customAttributes ? { customAttributes: c.customAttributes } : {})
        });
        contactIdsToGroup.push(newId);
      }
    }

    // 2. Perform createMany in ONE query for new contacts
    if (toCreate.length > 0) {
      await prisma.contact.createMany({
        data: toCreate,
        skipDuplicates: true
      });
      createdCount += toCreate.length;
    }

    // 3. Perform updates in parallel
    if (toUpdate.length > 0) {
      const updatePromises = toUpdate.map(upd =>
        prisma.contact.update({
          where: { id: upd.id },
          data: {
            name: upd.name,
            email: upd.email || null,
            notes: upd.notes,
            isAutoCreated: false,
            ...(upd.customAttributes ? { customAttributes: upd.customAttributes } : {}),
            ...(tagIds && tagIds.length > 0 ? { tags: { connect: tagIds.map(id => ({ id })) } } : {})
          }
        })
      );
      await Promise.all(updatePromises);
      createdCount += toUpdate.length;
    }

    // 4. Add all of these contacts to the group in batch
    if (contactIdsToGroup.length > 0) {
      const memberships = contactIdsToGroup.map(contactId => ({
        id: randomUUID(),
        groupId,
        contactId
      }));
      await prisma.contactGroupMember.createMany({
        data: memberships,
        skipDuplicates: true
      });
    }

    // Connect tags for newly created contacts
    const newContactIds = toCreate.map(c => c.id);
    if (newContactIds.length > 0 && tagIds && tagIds.length > 0) {
      const tagConnectPromises = newContactIds.map(id =>
        prisma.contact.update({
          where: { id },
          data: { tags: { connect: tagIds.map(tagId => ({ id: tagId })) } }
        })
      );
      await Promise.all(tagConnectPromises);
    }
  } catch (error) {
    console.error('Error in bulkImportContactsToGroup:', error);
    errors.push('Database execution error during batch import to group');
  }

  // Collect error info for invalid numbers in this batch
  contacts.forEach(c => {
    const waId = c.phoneNumber.replace(/\D/g, '');
    if (waId.length < 7) {
      errors.push(`${c.name || 'Unknown'}: Invalid number "${c.phoneNumber}"`);
    }
  });

  revalidatePath('/dashboard/contacts');
  return {
    success: true,
    createdCount,
    errorCount: errors.length,
    errors: errors.slice(0, 5)
  };
}
