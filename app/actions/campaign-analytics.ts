"use server"

import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"

export async function getCampaignAnalytics(flowId?: string) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    throw new Error("Unauthorized")
  }

  const executions = await prisma.flowExecution.findMany({
    where: {
      flow: {
        organizationId: session.user.organizationId
      },
      ...(flowId ? { flowId } : {})
    },
    select: {
      id: true,
      logs: true,
      contact: {
        select: {
          name: true,
          waId: true
        }
      },
      flow: {
        select: {
          id: true,
          name: true,
          nodes: true
        }
      }
    }
  })

  const stats: Record<string, { 
    nodeName: string, 
    type: string,
    impressions: number, 
    clicks: Record<string, { text: string, count: number }>,
    clickers: { name: string, waId: string, buttonText: string, timestamp: string }[]
  }> = {}

  executions.forEach(exec => {
    const logs = Array.isArray(exec.logs) ? exec.logs : []
    const nodes = (exec.flow.nodes as any[]) || []
    const contact = exec.contact

    logs.forEach((log: any) => {
      const node = nodes.find((n: any) => n.id === log.nodeId)
      const nodeName = node?.data?.name || node?.data?.message?.substring(0, 30) || log.nodeId

      if (!stats[log.nodeId]) {
        stats[log.nodeId] = {
          nodeName,
          type: log.nodeType,
          impressions: 0,
          clicks: {},
          clickers: []
        }
      }

      if (log.status === 'completed') {
        stats[log.nodeId].impressions++
      }

      if (log.status === 'interaction' && log.data?.buttonId) {
        const btnId = log.data.buttonId
        const buttonText = log.data.text || btnId
        
        if (!stats[log.nodeId].clicks[btnId]) {
          stats[log.nodeId].clicks[btnId] = {
            text: buttonText,
            count: 0
          }
        }
        stats[log.nodeId].clicks[btnId].count++

        // Add to clickers list
        if (contact) {
          stats[log.nodeId].clickers.push({
            name: contact.name || 'Unknown',
            waId: contact.waId,
            buttonText,
            timestamp: log.timestamp
          })
        }
      }
    })
  })

  // Flatten for UI
  const rows = Object.entries(stats).map(([nodeId, data]) => {
    const totalNodeClicks = Object.values(data.clicks).reduce((sum, c) => sum + c.count, 0)
    return {
      nodeId,
      ...data,
      totalClicks: totalNodeClicks,
      ctr: data.impressions > 0 ? (totalNodeClicks / data.impressions) * 100 : 0
    }
  })

  return {
    summary: {
      totalImpressions: rows.reduce((sum, r) => sum + r.impressions, 0),
      totalClicks: rows.reduce((sum, r) => sum + r.totalClicks, 0),
      avgCtr: rows.length > 0 ? rows.reduce((sum, r) => sum + r.ctr, 0) / rows.length : 0
    },
    rows: rows.sort((a, b) => b.impressions - a.impressions)
  }
}

export async function getActiveFlows() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return []
  
  return prisma.flow.findMany({
    where: { organizationId: session.user.organizationId },
    select: { id: true, name: true }
  })
}
