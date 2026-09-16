import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { getPusherServer } from '@/lib/pusher';

export interface AssignmentResult {
  assigned: boolean;
  agentId: string | null;
  assignmentType: 'manual' | 'tag' | 'round_robin' | null;
  reason?: string;
}

/**
 * Helper to notify assigned/previous agents via Pusher in real-time
 */
async function notifyAssignmentPusher(params: {
  organizationId: string;
  contactId: string;
  newAgentId: string | null;
  previousAgentId: string | null;
  assignmentType: string;
  assignedByName?: string | null;
}) {
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

      const payload = {
        contactId: params.contactId,
        newAgentId: params.newAgentId,
        previousAgentId: params.previousAgentId,
        assignmentType: params.assignmentType,
        assignedByName: params.assignedByName,
        timestamp: new Date().toISOString(),
      };

      // 1. Notify organization channel (for admin live views and list updates)
      await pusher.trigger(`org-${params.organizationId}`, 'chat-assignment-updated', payload);

      // 2. Notify newly assigned agent personal channel
      if (params.newAgentId) {
        await pusher.trigger(`user-${params.newAgentId}`, 'chat-assigned', payload);
      }

      // 3. Notify previous agent personal channel (to remove from inbox)
      if (params.previousAgentId && params.previousAgentId !== params.newAgentId) {
        await pusher.trigger(`user-${params.previousAgentId}`, 'chat-unassigned', payload);
      }
    }
  } catch (error) {
    logger.general.warn('PusherAssignment', `Failed to trigger assignment Pusher event: ${String(error)}`);
  }
}

/**
 * Checks if a given timestamp falls within the date range and time window for a specific timezone
 */
function isWithinTimeWindow(
  dateInput: Date | string | null | undefined,
  startDate?: Date | null,
  endDate?: Date | null,
  startTime?: string | null,
  endTime?: string | null,
  timezone = 'UTC'
): boolean {
  if (!dateInput) return false;
  try {
    const targetDate = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (Number.isNaN(targetDate.getTime())) return false;

    // Format target date into the rule's timezone components
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(targetDate);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

    const year = parseInt(getPart('year'), 10);
    const month = parseInt(getPart('month'), 10) - 1;
    const day = parseInt(getPart('day'), 10);
    const hour = parseInt(getPart('hour'), 10);
    const minute = parseInt(getPart('minute'), 10);

    const targetDayDate = new Date(Date.UTC(year, month, day));

    // 1. Date Range Boundaries
    if (startDate) {
      const sDate = new Date(startDate);
      const startDay = new Date(Date.UTC(sDate.getUTCFullYear(), sDate.getUTCMonth(), sDate.getUTCDate()));
      if (targetDayDate < startDay) return false;
    }

    if (endDate) {
      const eDate = new Date(endDate);
      const endDay = new Date(Date.UTC(eDate.getUTCFullYear(), eDate.getUTCMonth(), eDate.getUTCDate()));
      if (targetDayDate > endDay) return false;
    }

    // 2. Time Window Boundaries (e.g. 10:00 to 18:00)
    if (startTime && endTime) {
      const [startH, startM] = startTime.split(':').map((v) => parseInt(v, 10) || 0);
      const [endH, endM] = endTime.split(':').map((v) => parseInt(v, 10) || 0);

      const currentMinutes = hour * 60 + minute;
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes <= endMinutes) {
        if (currentMinutes < startMinutes || currentMinutes > endMinutes) return false;
      } else {
        // Crosses midnight window (e.g. 22:00 to 06:00)
        if (currentMinutes < startMinutes && currentMinutes > endMinutes) return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluates auto-assignment rules for a new or unassigned conversation:
 * Priority 1: Keep existing assignment if already assigned
 * Priority 2: Tag-Based Assignment (Ordered by admin rule priority)
 * Priority 3: Round-Robin Fallback
 */
export async function evaluateAndAssignConversation(
  contactId: string,
  organizationId: string,
  options?: { forceAutoAssign?: boolean; isNewContact?: boolean }
): Promise<AssignmentResult> {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      include: {
        tags: { select: { id: true, name: true } },
        assignedUsers: { select: { id: true, role: true, status: true } },
      },
    });

    if (!contact) {
      return { assigned: false, agentId: null, assignmentType: null, reason: 'Contact not found' };
    }

    // Priority 1 Check: Already assigned to an active agent?
    // A conversation is only considered assigned if assignedAgentId is set to an active agent,
    // or assignedUsers contains an active USER agent (ignoring ADMINs and inactive users).
    let currentAgentId = contact.assignedAgentId || null;
    if (!currentAgentId && contact.assignedUsers && contact.assignedUsers.length > 0) {
      const activeUserAgent = contact.assignedUsers.find(
        (u) => (u as any).role === 'USER' && (u as any).status === 'ACTIVE'
      );
      if (activeUserAgent) {
        currentAgentId = activeUserAgent.id;
      }
    }

    if (currentAgentId && !options?.forceAutoAssign) {
      return {
        assigned: true,
        agentId: currentAgentId,
        assignmentType: (contact.assignmentType as any) || 'manual',
        reason: 'Conversation is already assigned',
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        autoAssignmentEnabled: true,
        roundRobinFallbackEnabled: true,
        roundRobinBatchSize: true,
        roundRobinCurrentCount: true,
        roundRobinLastAgentId: true,
        roundRobinConfig: true,
      },
    });

    if (!org || org.autoAssignmentEnabled === false) {
      return { assigned: false, agentId: null, assignmentType: null, reason: 'Auto-assignment is disabled' };
    }

    // Priority 2: Comprehensive Agent Chat Assignment Rules
    const contactTagIds = contact.tags.map((t) => t.id);
    const agentRules = await prisma.agentChatAssignmentRule.findMany({
      where: {
        organizationId,
        isActive: true,
        agent: {
          status: 'ACTIVE',
          availabilityStatus: { not: 'UNAVAILABLE' },
        },
      },
      orderBy: [
        { priority: 'asc' },
        { createdAt: 'asc' },
      ],
      include: {
        agent: {
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            status: true,
            availabilityStatus: true,
          },
        },
      },
    });

    const now = new Date();
    const messageTime = contact.lastInboundMessageAt || contact.lastMessageAt || contact.createdAt || now;

    for (const rule of agentRules) {
      let isMatch = false;

      switch (rule.assignmentType) {
        case 'SPECIFIC_CHAT':
          if (rule.specificChatIds && rule.specificChatIds.includes(contact.id)) {
            isMatch = true;
          }
          break;

        case 'AFTER_AGENT_CREATION':
          if (rule.agent?.createdAt) {
            const agentCreatedTime = new Date(rule.agent.createdAt).getTime();
            const contactMsgTime = new Date(messageTime).getTime();
            if (contactMsgTime >= agentCreatedTime) {
              isMatch = true;
            }
          }
          break;

        case 'ALL_CHATS':
          isMatch = true;
          break;

        case 'TAG_BASED':
          if (
            rule.tagIds &&
            rule.tagIds.length > 0 &&
            contactTagIds.some((id) => rule.tagIds.includes(id))
          ) {
            isMatch = true;
          }
          break;

        case 'DATETIME_RANGE':
          isMatch = isWithinTimeWindow(
            messageTime,
            rule.startDate,
            rule.endDate,
            rule.startTime,
            rule.endTime,
            rule.timezone || 'UTC'
          );
          break;

        default:
          break;
      }

      if (isMatch && rule.agent) {
        const assignedAgentId = rule.agent.id;

        await prisma.$transaction([
          prisma.contact.update({
            where: { id: contactId },
            data: {
              assignedAgentId,
              assignmentType: rule.assignmentType.toLowerCase(),
              assignedAt: new Date(),
              assignedUsers: { set: [{ id: assignedAgentId }] },
            },
          }),
          prisma.chatAssignmentHistory.create({
            data: {
              organizationId,
              contactId,
              agentId: assignedAgentId,
              previousAgentId: currentAgentId,
              assignmentType: rule.assignmentType.toLowerCase(),
              tagId: rule.assignmentType === 'TAG_BASED' && rule.tagIds[0] ? rule.tagIds[0] : undefined,
            },
          }),
        ]);

        await notifyAssignmentPusher({
          organizationId,
          contactId,
          newAgentId: assignedAgentId,
          previousAgentId: currentAgentId,
          assignmentType: rule.assignmentType.toLowerCase(),
        });

        logger.general.info(
          'AssignmentEngine',
          `Contact ${contactId} assigned to Agent ${assignedAgentId} via ${rule.assignmentType} Rule (Priority ${rule.priority})`
        );

        return {
          assigned: true,
          agentId: assignedAgentId,
          assignmentType: (rule.assignmentType.toLowerCase() as any),
        };
      }
    }

    // Priority 2.5: Legacy Tag-Based Automatic Assignment (Fallback)
    if (contactTagIds.length > 0) {
      const tagRules = await prisma.tagAssignmentRule.findMany({
        where: {
          organizationId,
          tagId: { in: contactTagIds },
          agent: {
            status: 'ACTIVE',
            availabilityStatus: { not: 'UNAVAILABLE' },
          },
        },
        orderBy: { priority: 'asc' },
        include: {
          agent: { select: { id: true, name: true, status: true, availabilityStatus: true } },
        },
      });

      if (tagRules.length > 0) {
        const winningRule = tagRules[0];
        const assignedAgentId = winningRule.agentId;

        await prisma.$transaction([
          prisma.contact.update({
            where: { id: contactId },
            data: {
              assignedAgentId,
              assignmentType: 'tag',
              assignedAt: new Date(),
              assignedUsers: { set: [{ id: assignedAgentId }] },
            },
          }),
          prisma.chatAssignmentHistory.create({
            data: {
              organizationId,
              contactId,
              agentId: assignedAgentId,
              previousAgentId: currentAgentId,
              assignmentType: 'tag',
              tagId: winningRule.tagId,
            },
          }),
        ]);

        await notifyAssignmentPusher({
          organizationId,
          contactId,
          newAgentId: assignedAgentId,
          previousAgentId: currentAgentId,
          assignmentType: 'tag',
        });

        logger.general.info(
          'AssignmentEngine',
          `Contact ${contactId} assigned to Agent ${assignedAgentId} via Tag Rule (Priority ${winningRule.priority})`
        );

        return {
          assigned: true,
          agentId: assignedAgentId,
          assignmentType: 'tag',
        };
      }
    }

    // Priority 3: Round-Robin Fallback with Batch Rotation
    if (org.roundRobinFallbackEnabled) {
      const roundRobinConfig = (org.roundRobinConfig as any) || {};
      const routingScope = roundRobinConfig.routingScope || 'NEW_ONLY';

      // If configured for NEW_ONLY, verify if this conversation is a fresh / new chat
      if (routingScope === 'NEW_ONLY') {
        let isFreshChat = options?.isNewContact;

        if (isFreshChat === undefined) {
          // If isNewContact was not explicitly passed, inspect message history
          const priorMessageCount = await prisma.message.count({
            where: { contactId: contact.id },
          });
          const isRecentlyCreated = (Date.now() - new Date(contact.createdAt).getTime()) < 5 * 60 * 1000;
          isFreshChat = priorMessageCount <= 1 || isRecentlyCreated;
        }

        if (!isFreshChat) {
          return {
            assigned: false,
            agentId: null,
            assignmentType: null,
            reason: 'Skipped Round-Robin: Contact has existing chat history and routingScope is set to NEW_ONLY',
          };
        }
      }

      const eligibleAgents = await prisma.user.findMany({
        where: {
          organizationId,
          role: 'USER',
          status: 'ACTIVE',
          isAutoAssignEligible: true,
          availabilityStatus: { not: 'UNAVAILABLE' },
        },
        select: { id: true, name: true, email: true },
        orderBy: { createdAt: 'asc' },
      });

      if (eligibleAgents.length > 0) {
        const batchSize = Math.max(1, org.roundRobinBatchSize || 1);
        const currentCount = org.roundRobinCurrentCount || 0;
        const lastAgentId = org.roundRobinLastAgentId;
        const roundRobinConfig = (org.roundRobinConfig as any) || {};
        const agentWeights = roundRobinConfig.agentWeights || {};

        let selectedAgentId = eligibleAgents[0].id;
        let newCount = 1;

        // Check if last agent is still eligible in this round
        const lastAgentIndex = lastAgentId ? eligibleAgents.findIndex((a) => a.id === lastAgentId) : -1;
        const targetBatchForLastAgent = lastAgentId && agentWeights[lastAgentId] ? Number(agentWeights[lastAgentId]) : batchSize;

        if (lastAgentIndex !== -1 && currentCount < targetBatchForLastAgent) {
          // Continue current batch for the same agent
          selectedAgentId = lastAgentId!;
          newCount = currentCount + 1;
        } else {
          // Batch completed or new cycle -> rotate to next eligible agent
          const nextIndex = lastAgentIndex !== -1 ? (lastAgentIndex + 1) % eligibleAgents.length : 0;
          selectedAgentId = eligibleAgents[nextIndex].id;
          newCount = 1;
        }

        await prisma.$transaction([
          prisma.contact.update({
            where: { id: contactId },
            data: {
              assignedAgentId: selectedAgentId,
              assignmentType: 'round_robin',
              assignedAt: new Date(),
              assignedUsers: { set: [{ id: selectedAgentId }] },
            },
          }),
          prisma.organization.update({
            where: { id: organizationId },
            data: {
              roundRobinLastAgentId: selectedAgentId,
              roundRobinCurrentCount: newCount,
            },
          }),
          prisma.chatAssignmentHistory.create({
            data: {
              organizationId,
              contactId,
              agentId: selectedAgentId,
              previousAgentId: currentAgentId,
              assignmentType: 'round_robin',
            },
          }),
        ]);

        await notifyAssignmentPusher({
          organizationId,
          contactId,
          newAgentId: selectedAgentId,
          previousAgentId: currentAgentId,
          assignmentType: 'round_robin',
        });

        logger.general.info(
          'AssignmentEngine',
          `Contact ${contactId} assigned to Agent ${selectedAgentId} via Batch Round-Robin (${newCount}/${batchSize})`
        );

        return {
          assigned: true,
          agentId: selectedAgentId,
          assignmentType: 'round_robin',
        };
      }
    }

    return { assigned: false, agentId: null, assignmentType: null, reason: 'No eligible agent available' };
  } catch (error: any) {
    logger.general.error('AssignmentEngine', `Error in evaluateAndAssignConversation: ${error.message}`);
    return { assigned: false, agentId: null, assignmentType: null, reason: error.message };
  }
}

/**
 * Manually assigns or reassigns a conversation to an agent (Admin action)
 */
export async function assignConversationManually(params: {
  contactId: string;
  organizationId: string;
  agentId: string | null;
  assignedByUserId: string;
  assignedByName?: string | null;
}): Promise<AssignmentResult> {
  const { contactId, organizationId, agentId, assignedByUserId, assignedByName } = params;

  try {
    const contact = await prisma.contact.findFirst({
      where: { id: contactId, organizationId },
      select: { id: true, assignedAgentId: true },
    });

    if (!contact) {
      return { assigned: false, agentId: null, assignmentType: null, reason: 'Contact not found' };
    }

    const previousAgentId = contact.assignedAgentId;

    if (agentId) {
      // Assign to agent
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: contactId },
          data: {
            assignedAgentId: agentId,
            assignmentType: 'manual',
            assignedAt: new Date(),
            assignedUsers: { set: [{ id: agentId }] },
          },
        }),
        prisma.chatAssignmentHistory.create({
          data: {
            organizationId,
            contactId,
            agentId,
            previousAgentId,
            assignmentType: 'manual',
            assignedByUserId,
          },
        }),
      ]);
    } else {
      // Unassign all
      await prisma.$transaction([
        prisma.contact.update({
          where: { id: contactId },
          data: {
            assignedAgentId: null,
            assignmentType: null,
            assignedAt: null,
            assignedUsers: { set: [] },
          },
        }),
        prisma.chatAssignmentHistory.create({
          data: {
            organizationId,
            contactId,
            agentId: null,
            previousAgentId,
            assignmentType: 'manual',
            assignedByUserId,
          },
        }),
      ]);
    }

    await notifyAssignmentPusher({
      organizationId,
      contactId,
      newAgentId: agentId,
      previousAgentId,
      assignmentType: 'manual',
      assignedByName,
    });

    logger.general.info(
      'AssignmentEngine',
      `Contact ${contactId} manually ${agentId ? `assigned to Agent ${agentId}` : 'unassigned'} by User ${assignedByUserId}`
    );

    return {
      assigned: true,
      agentId,
      assignmentType: agentId ? 'manual' : null,
    };
  } catch (error: any) {
    logger.general.error('AssignmentEngine', `Error in assignConversationManually: ${error.message}`);
    return { assigned: false, agentId: null, assignmentType: null, reason: error.message };
  }
}

/**
 * Bulk unassign all conversations currently assigned to a specific agent in an organization
 */
export async function unassignAllChatsForAgent(params: {
  organizationId: string;
  agentId: string;
  assignedByUserId: string;
  assignedByName?: string | null;
}): Promise<{ count: number }> {
  const { organizationId, agentId, assignedByUserId, assignedByName } = params;

  try {
    const contacts = await prisma.contact.findMany({
      where: {
        organizationId,
        OR: [
          { assignedAgentId: agentId },
          { assignedUsers: { some: { id: agentId } } },
        ],
      },
      select: { id: true, assignedAgentId: true },
    });

    if (contacts.length === 0) {
      return { count: 0 };
    }

    const contactIds = contacts.map((c) => c.id);

    // 1. Clear assignedAgentId for all contacts directly assigned to this agent
    await prisma.contact.updateMany({
      where: {
        id: { in: contactIds },
        organizationId,
        assignedAgentId: agentId,
      },
      data: {
        assignedAgentId: null,
        assignmentType: null,
        assignedAt: null,
      },
    });

    // 2. Disconnect agent from assignedUsers and record history + pusher event for each contact
    for (const contact of contacts) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          assignedUsers: { disconnect: [{ id: agentId }] },
        },
      }).catch(() => {});

      await prisma.chatAssignmentHistory.create({
        data: {
          organizationId,
          contactId: contact.id,
          agentId: null,
          previousAgentId: agentId,
          assignmentType: 'manual',
          assignedByUserId,
        },
      }).catch(() => {});

      await notifyAssignmentPusher({
        organizationId,
        contactId: contact.id,
        newAgentId: null,
        previousAgentId: agentId,
        assignmentType: 'manual',
        assignedByName,
      }).catch(() => {});
    }

    logger.general.info(
      'AssignmentEngine',
      `Successfully unassigned ${contacts.length} conversations from Agent ${agentId} by User ${assignedByUserId}`
    );

    return { count: contacts.length };
  } catch (error: any) {
    logger.general.error('AssignmentEngine', `Error in unassignAllChatsForAgent: ${error.message}`);
    throw error;
  }
}

