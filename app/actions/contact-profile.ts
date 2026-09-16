'use server';

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function getContactProfileData(contactId: string) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.organizationId) {
        throw new Error("Unauthorized");
    }

    const contact = await prisma.contact.findFirst({
        where: { 
            id: contactId,
            organizationId: session.user.organizationId
        },
        include: {
            tags: true,
            flowExecutions: {
                include: {
                    flow: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    startedAt: 'desc'
                }
            },
            messages: {
                take: 100,
                orderBy: {
                    createdAt: 'desc'
                },
                include: {
                    sender: {
                        select: {
                            name: true
                        }
                    }
                }
            }
        }
    });

    if (!contact) return null;

    // Build campaigns list
    const campaignSet = new Map<string, any>();

    // 1. Meta Ad Campaigns (from message referrals)
    contact.messages.forEach(m => {
        const referral = (m.rawBody as any)?.referral;
        if (referral && referral.source_id) {
            const platform = referral.source_url?.includes('instagram.com') ? 'Instagram' : 'Facebook';
            const campaignName = `${platform} Ad: ${referral.headline || referral.source_id}`;
            
            const existing = campaignSet.get(referral.source_id);
            if (!existing || m.createdAt > existing.lastExecutedAt) {
                campaignSet.set(referral.source_id, {
                    id: referral.source_id,
                    name: campaignName,
                    lastExecutedAt: m.createdAt
                });
            }
        }
    });

    const campaigns = Array.from(campaignSet.values());

    // Build journey (Lifecycle Timeline)
    const journey: any[] = [];

    // 1. Contact Creation
    journey.push({
        type: 'START',
        title: 'Contact Registered',
        timestamp: contact.createdAt
    });

    // 2. Flow Executions (Automations)
    contact.flowExecutions.forEach(ex => {
        journey.push({
            type: 'CAMPAIGN',
            title: `Automation: ${ex.flow.name}`,
            content: `Status: ${ex.status}`,
            timestamp: ex.startedAt
        });
    });

    // 3. Ad Interaction Journey Items
    contact.messages.forEach(m => {
        const referral = (m.rawBody as any)?.referral;
        if (referral) {
            const platform = referral.source_url?.includes('instagram.com') ? 'Instagram' : 'Facebook';
            journey.push({
                type: 'CAMPAIGN',
                title: `Ad Interaction: ${platform}`,
                content: `Headline: ${referral.headline || 'N/A'}`,
                timestamp: m.createdAt
            });
        }
    });

    // 4. Chat Lifecycle & Human Interventions
    const allMessages = [...contact.messages].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const inboundMessages = allMessages.filter(m => m.direction === 'inbound');

    // Detect Service Conversations (First inbound or after window reset)
    let lastWindowEndTime = 0;
    inboundMessages.forEach(msg => {
        const msgTime = msg.createdAt.getTime();
        if (msgTime > lastWindowEndTime) {
            journey.push({
                type: 'WINDOW_OPEN',
                title: 'Service Conversation Started',
                content: 'User initiated a conversation',
                timestamp: msg.createdAt
            });
            
            const expiryTime = msgTime + (24 * 60 * 60 * 1000);
            lastWindowEndTime = expiryTime;

            if (expiryTime < Date.now()) {
                journey.push({
                    type: 'WINDOW_CLOSE',
                    title: 'Auto Closed',
                    content: '24h window expired',
                    timestamp: new Date(expiryTime)
                });
            }
        }
    });
    let lastAgentId = '';
    allMessages.forEach(msg => {
        if (msg.direction === 'outbound' && msg.senderId && msg.sender?.name) {
            if (msg.senderId !== lastAgentId) {
                journey.push({
                    type: 'CHAT_START',
                    title: `Chat Intervened by ${msg.sender.name}`,
                    content: (msg.content || '').slice(0, 60) + ((msg.content?.length || 0) > 60 ? '...' : ''),
                    timestamp: msg.createdAt
                });
                lastAgentId = msg.senderId;
            }
        } else if (msg.direction === 'inbound') {
             lastAgentId = '';
        }
    });
    const sortedJourney = journey.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return {
        campaigns,
        tags: contact.tags,
        journey
    };
}
