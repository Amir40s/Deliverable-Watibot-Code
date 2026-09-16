import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { checkQuota } from '@/lib/quota'

const tabCountsCache = new Map<string, { counts: [number, number, number, number, number, number, number, number]; expiresAt: number }>();

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // 'contacts' or 'messages'
  const contactId = searchParams.get('contactId')

  try {
    if (type === 'contacts') {
      const limit = parseInt(searchParams.get('limit') || '10', 10)
      const offset = parseInt(searchParams.get('offset') || '0', 10)
      const search = searchParams.get('search') || ''
      const tab = searchParams.get('tab') || 'all'
      const platform = searchParams.get('platform') || 'all'
      const filtersParam = searchParams.get('filters')
      const organization = await prisma.organization.findUnique({
        where: { id: session.user.organizationId },
        select: { isAiBotEnabled: true }
      })
      const organizationAiEnabled = organization?.isAiBotEnabled ?? false
      
      let filters: any = {}
      if (filtersParam) {
        try {
          filters = JSON.parse(filtersParam)
        } catch (e) {
          console.error('Failed to parse filters:', e)
        }
      }

      // Build the query using an array of AND conditions to avoid conflicts
      const andClauses: any[] = [
        {
          organizationId: session.user.organizationId
        },
        {
          lastMessage: { not: null }
        },
        {
          lastMessage: { not: "" }
        }
      ]

      const isAdmin = session.user.role === 'ADMIN' || session.user.role === 'SUPER_ADMIN';
      if (!isAdmin) {
        andClauses.push({
          OR: [
            { assignedAgentId: session.user.id },
            { assignedUsers: { some: { id: session.user.id } } },
          ],
        });
      }

      // Apply main search or keyword search - safe on SQLite and Postgres
      const searchVal = filters.keyword || search || ''
      if (searchVal.trim()) {
        const digitsOnly = searchVal.replace(/\D/g, '')
        const searchOR: any[] = [
          { name: { contains: searchVal, mode: 'insensitive' } },
          { whatsappName: { contains: searchVal, mode: 'insensitive' } },
          { firstName: { contains: searchVal, mode: 'insensitive' } },
          { lastName: { contains: searchVal, mode: 'insensitive' } },
          { email: { contains: searchVal, mode: 'insensitive' } },
          { waId: { contains: searchVal } }
        ]
        if (digitsOnly) {
          searchOR.push({ waId: { contains: digitsOnly } })
        }
        andClauses.push({ OR: searchOR })
      }

      // Apply platform channel filter case-insensitively
      if (filters.platform && filters.platform.toLowerCase() !== 'all') {
        andClauses.push({
          platform: filters.platform.toUpperCase()
        })
      } else if (platform && platform.toLowerCase() !== 'all') {
        andClauses.push({
          platform: platform.toUpperCase()
        })
      }

      // Apply specific WhatsApp channel filter
      const channelId = searchParams.get('channelId') || filters.channelId || '';
      if (channelId && channelId !== 'all') {
        const targetChannel = await prisma.whatsAppChannel.findUnique({
          where: { id: channelId },
          select: { id: true, isDefault: true, connectionMethod: true, phoneNumberId: true }
        });

        if (targetChannel) {
          const isQrChannel = targetChannel.connectionMethod === 'qr' || targetChannel.phoneNumberId?.startsWith('qr_');
          andClauses.push({
            platform: 'WHATSAPP',
            messages: {
              some: {
                OR: [
                  { channelId: targetChannel.id },
                  ...(targetChannel.isDefault || isQrChannel ? [{ channelId: null }] : []),
                ]
              }
            }
          });
        }
      }

      // Apply read status filter case-insensitively
      if (filters.readStatus && filters.readStatus.toLowerCase() !== 'all') {
        if (filters.readStatus.toLowerCase() === 'unread') {
          andClauses.push({ unreadCount: { gt: 0 } })
        } else if (filters.readStatus.toLowerCase() === 'read') {
          andClauses.push({ unreadCount: 0 })
        }
      }

      // Apply agent filters
      if (filters.agentIds && filters.agentIds.length > 0) {
        andClauses.push({
          assignedUsers: {
            some: {
              id: { in: filters.agentIds }
            }
          }
        })
      }

      // Apply tag filters
      if (filters.tagIds && filters.tagIds.length > 0) {
        andClauses.push({
          tags: {
            some: {
              id: { in: filters.tagIds }
            }
          }
        })
      }

      // Apply date range filters
      if (filters.dateMode && filters.dateMode !== 'All') {
        const now = new Date()
        let fromDate: Date | null = null
        let toDate: Date | null = null

        if (filters.dateMode === 'Today') {
          fromDate = new Date(now.setHours(0,0,0,0))
        } else if (filters.dateMode === 'Yesterday') {
          const startOfToday = new Date(now.setHours(0,0,0,0))
          fromDate = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000)
          toDate = startOfToday
        } else if (filters.dateMode === 'This Week') {
          fromDate = new Date(now.getTime() - (now.getDay() * 24 * 60 * 60 * 1000))
          fromDate.setHours(0,0,0,0)
        } else if (filters.dateMode === 'This Month') {
          fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        } else if (filters.dateMode === 'Custom') {
          if (filters.dateFrom) fromDate = new Date(filters.dateFrom)
          if (filters.dateTo) toDate = new Date(filters.dateTo)
        }

        if (fromDate || toDate) {
          const dateRangeClause: any = {}
          if (fromDate) dateRangeClause.gte = fromDate
          if (toDate) dateRangeClause.lte = toDate
          andClauses.push({
            lastMessageAt: dateRangeClause
          })
        }
      }

      const baseWhere = { AND: andClauses }

      // Prepare tab-specific count queries
      const allWhere = { ...baseWhere }
      const unreadWhere = { 
        AND: [
          ...andClauses, 
          { unreadCount: { gt: 0 } }
        ] 
      }
      const myChatsWhere = { 
        AND: [
          ...andClauses, 
          { 
            OR: [
              { assignedAgentId: session.user.id },
              { 
                assignedUsers: { 
                  some: { 
                    OR: [
                      { id: session.user.id },
                      { email: session.user.email || '' }
                    ]
                  } 
                } 
              }
            ]
          }
        ] 
      }
      const [aiAgentWebhooks, org] = await Promise.all([
        prisma.externalWebhook.findMany({
          where: { organizationId: session.user.organizationId, isAiAgent: true },
          select: { id: true }
        }),
        prisma.organization.findUnique({
          where: { id: session.user.organizationId },
          select: { whatsappConnectionMethod: true, isAiBotEnabled: true }
        })
      ]);
      const isQr = org?.whatsappConnectionMethod === 'qr';
      const aiWebhookIds = aiAgentWebhooks.map(w => w.id);

      const interventedWhere = { 
        AND: [
          ...andClauses,
          {
            OR: [
              { isAiBotEnabled: false },
              { isWebhookEnabled: false },
              ...(aiWebhookIds.length > 0 ? [{ disabledWebhookIds: { hasSome: aiWebhookIds } }] : [])
            ]
          }
        ]
      }
      const aiWhere = { 
        AND: [
          ...andClauses,
          { isAiBotEnabled: true },
          { isWebhookEnabled: { not: false } },
          { organization: { isAiBotEnabled: true } },
          ...(aiWebhookIds.length > 0 ? [{ NOT: { disabledWebhookIds: { hasSome: aiWebhookIds } } }] : []),
          ...(isQr ? [] : [{ lastInboundMessageAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }])
        ]
      }
      const expiredWhere = isQr
        ? { AND: [...andClauses, { id: 'none' }] }
        : { 
            AND: [
              ...andClauses,
              {
                OR: [
                  { lastInboundMessageAt: null },
                  { lastInboundMessageAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
                ]
              }
            ]
          }
      const urgentWhere = {
        AND: [
          ...andClauses,
          {
            tags: {
              some: {
                name: { contains: 'urgent' }
              }
            }
          }
        ]
      }
      const visitorsWhere = {
        AND: [
          ...andClauses,
          {
            OR: [
              { waId: { startsWith: 'web_' } },
              { tags: { some: { name: { equals: 'Website', mode: 'insensitive' } } } }
            ]
          }
        ]
      }

      // Cache tab counts per org for 15s to reduce count query thrashing
      const cacheKey = `${session.user.organizationId}_${session.user.id}_${JSON.stringify(filters)}_${channelId}`;
      const now = Date.now();
      const cachedTabCounts = tabCountsCache.get(cacheKey);

      let totalAll = 0, totalUnread = 0, totalAssigned = 0, totalAi = 0, totalIntervented = 0, totalExpired = 0, totalUrgent = 0, totalVisitors = 0;

      if (cachedTabCounts && cachedTabCounts.expiresAt > now) {
        [totalAll, totalUnread, totalAssigned, totalAi, totalIntervented, totalExpired, totalUrgent, totalVisitors] = cachedTabCounts.counts;
      } else {
        const counts = await Promise.all([
          prisma.contact.count({ where: allWhere }).catch(() => 0),
          prisma.contact.count({ where: unreadWhere }).catch(() => 0),
          prisma.contact.count({ where: myChatsWhere }).catch(() => 0),
          prisma.contact.count({ where: aiWhere }).catch(() => 0),
          prisma.contact.count({ where: interventedWhere }).catch(() => 0),
          isQr ? Promise.resolve(0) : prisma.contact.count({ where: expiredWhere }).catch(() => 0),
          prisma.contact.count({ where: urgentWhere }).catch(() => 0),
          prisma.contact.count({ where: visitorsWhere }).catch(() => 0)
        ]);
        [totalAll, totalUnread, totalAssigned, totalAi, totalIntervented, totalExpired, totalUrgent, totalVisitors] = counts;
        tabCountsCache.set(cacheKey, { counts, expiresAt: now + 15000 });
      }

      // Select correct query where filter based on active tab
      let listWhere = allWhere
      if (tab === 'unread') {
        listWhere = unreadWhere
      } else if (tab === 'assigned' || tab === 'my-chats') {
        listWhere = myChatsWhere
      } else if (tab === 'ai') {
        listWhere = aiWhere
      } else if (tab === 'intervented') {
        listWhere = interventedWhere
      } else if (tab === 'history') {
        listWhere = expiredWhere
      } else if (tab === 'urgent') {
        listWhere = urgentWhere
      } else if (tab === 'visitors' || tab === 'website') {
        listWhere = visitorsWhere
      }

      const [data, defaultOrgAiAgent] = await Promise.all([
        prisma.contact.findMany({
          where: listWhere,
          orderBy: { lastMessageAt: 'desc' },
          take: limit,
          skip: offset,
          include: {
            _count: { select: { messages: true } },
            messages: {
              where: { type: { notIn: ['comment', 'comment_reply', 'internal_log'] } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                content: true,
                type: true,
                createdAt: true,
              }
            },
            assignedUsers: { select: { id: true, name: true, email: true } },
            tags: { select: { id: true, name: true, color: true } },
            aiAgent: { select: { id: true, name: true, aiProvider: true, isDefault: true } },
            organization: {
              select: {
                isAiBotEnabled: true,
              },
            }
          }
        }),
        prisma.aIAgent.findFirst({
          where: { organizationId: session.user.organizationId as string, isDefault: true },
          select: { id: true, name: true, aiProvider: true, isDefault: true }
        }).catch(() => null)
      ]);

      const formatPreview = (m?: { content?: string | null; type?: string | null }) => {
        if (!m) return null;
        if (m.content && m.content.trim() !== '') return m.content.trim();
        const rawType = (m.type || 'text').toLowerCase();
        switch (rawType) {
          case 'image': return '[Image]';
          case 'video': return '[Video]';
          case 'audio': return '[Audio]';
          case 'voice':
          case 'ptt': return '[Voice Message]';
          case 'document': return '[Document]';
          case 'sticker': return '[Sticker]';
          case 'location': return '[Location]';
          case 'contact': return '[Contact]';
          default: return `[${rawType}]`;
        }
      };

      const contacts = data.map((contact: any) => {
        const defaultAiAgent = defaultOrgAiAgent || null
        const effectiveAiAgent = contact.aiAgent || defaultAiAgent
        const organization = contact.organization
          ? { isAiBotEnabled: contact.organization.isAiBotEnabled }
          : null

        const latestMsg = contact.messages?.[0]
        const computedLastMessage = latestMsg ? formatPreview(latestMsg) : contact.lastMessage
        const computedLastMessageAt = latestMsg ? latestMsg.createdAt : contact.lastMessageAt

        return {
          ...contact,
          lastMessage: computedLastMessage,
          lastMessageAt: computedLastMessageAt,
          organization,
          defaultAiAgent,
          effectiveAiAgent,
          aiAgentSource: contact.aiAgent ? 'assigned' : defaultAiAgent ? 'default' : 'none',
        }
      })

      const quota = await checkQuota(session.user.organizationId as string, 'maxBotReplies');

      return NextResponse.json({
        organizationAiEnabled,
        contacts,
        messageQuota: {
          allowed: quota.allowed,
          limit: quota.limit,
          current: quota.current,
          message: quota.message
        },
        tabCounts: {
          all: totalAll,
          unread: totalUnread,
          assigned: totalAssigned,
          ai: totalAi,
          intervented: totalIntervented,
          expired: totalExpired,
          urgent: totalUrgent,
          visitors: totalVisitors
        }
      })
    }

    if (type === 'messages' && contactId) {
      const { verifyAgentConversationAccess } = await import('@/lib/chat/permission-guard');
      const accessCheck = await verifyAgentConversationAccess(session, contactId);
      if (!accessCheck.allowed) {
        return new NextResponse(accessCheck.error || 'Forbidden', { status: 403 });
      }
      const messages = await prisma.message.findMany({
        where: {
          contactId,
          type: { notIn: ['comment', 'comment_reply'] }
        },
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

       prisma.contact.findUnique({
        where: { id: contactId },
        select: { id: true, profilePic: true, platform: true }
      }).then((targetContact) => {
        if (targetContact && !targetContact.profilePic && targetContact.platform === 'WHATSAPP' && session.user.organizationId) {
          const orgId = session.user.organizationId;
          import('@/lib/whatsapp/qr/service').then(({ syncContactProfilePic }) => {
            syncContactProfilePic(orgId, contactId).catch(() => {});
          }).catch(() => {});
        }
      }).catch(() => {});

      return NextResponse.json(messages)
    }

    if (type === 'scheduler') {
      // Soft trigger for scheduled messages to ensure they run in dev environments
      try {
                processScheduledMessages('SCHEDULED').catch(err => console.error('[Poll/SchedulerTrigger] Error:', err));
      } catch (err) {
        console.error('[Poll/SchedulerTrigger] Import error:', err);
      }

      const scheduledMessages = await prisma.scheduledMessage.findMany({
        where: { 
          organizationId: session.user.organizationId,
          type: 'SCHEDULED'
        },
        include: {
          contact: { select: { name: true, waId: true } },
          group: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json(scheduledMessages)
    }

    if (type === 'drip-scheduler') {
      // Soft trigger for campaigns to ensure they run in dev environments
      try {
                processScheduledMessages('DRIP').catch(err => console.error('[Poll/DripTrigger] Error:', err));
        processScheduledMessages('SCHEDULED').catch(err => console.error('[Poll/SchedulerTrigger] Error:', err));
      } catch (err) {
        console.error('[Poll/DripTrigger] Import error:', err);
      }

      const scheduledMessages = await prisma.scheduledMessage.findMany({
        where: { 
          organizationId: session.user.organizationId,
          type: { in: ['DRIP', 'SCHEDULED'] }
        },
        include: {
          contact: { select: { name: true, waId: true } },
          group: {
            select: {
              name: true,
              contacts: {
                include: {
                  contact: { select: { name: true, waId: true } }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
      return NextResponse.json(scheduledMessages)
    }

    return new NextResponse('Invalid request', { status: 400 })
  } catch (error) {
    console.error('API Error:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
