import { prisma } from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface CampaignHealthSummary {
  id: string;
  name: string;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  ignored: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
  status?: string;
}

export interface HealthMetricsInput {
  totalSent: number;
  deliveredCount: number;
  failedCount: number;
  readCount: number;
  repliedUsersCount: number;
  notRepliedUsersCount: number;
  ignoredMessagesCount: number;
  deliveryRate: number;
  readRate: number;
  replyRate: number;
  ignoreRate: number;
  failureRate: number;
  activeCampaignsCount: number;
  campaigns: CampaignHealthSummary[];
  metaQualityRating?: string | null;
  whatsappConnectionMethod?: string | null;
  periodDays: number;
}

export interface HealthRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  impact: string;
}

export interface AIHealthAnalysisResult {
  healthScore: number; // 0..100
  healthStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  engagementQuality: string;
  deliveryQuality: string;
  userResponseQuality: string;
  campaignPerformance: string;
  positiveFactors: string[];
  riskFactors: string[];
  recommendations: HealthRecommendation[];
  analyzedAt: string;
  engine: 'ai' | 'heuristic';
}

/**
 * Deterministic fallback scoring algorithm used when no AI provider key is configured
 * or when external LLM APIs are unreachable.
 */
export function calculateHeuristicHealthAudit(metrics: HealthMetricsInput): AIHealthAnalysisResult {
  const {
    totalSent,
    deliveredCount,
    deliveryRate,
    readRate,
    replyRate,
    failureRate,
    activeCampaignsCount,
    metaQualityRating,
  } = metrics;

  if (totalSent === 0) {
    return {
      healthScore: 85,
      healthStatus: 'GOOD',
      riskLevel: 'LOW',
      engagementQuality: 'No outbound traffic recorded in this period. The number is in a resting, neutral state.',
      deliveryQuality: 'Clean baseline. No failed attempts or spam signals detected.',
      userResponseQuality: 'Awaiting outbound broadcast or customer communication.',
      campaignPerformance: `${activeCampaignsCount} active campaign(s) configured.`,
      positiveFactors: [
        'Zero delivery failures or spam flags recorded',
        'Clean sender reputation baseline',
        'No rate limit or policy strikes detected',
      ],
      riskFactors: [
        'Insufficient recent traffic volume to benchmark long-term engagement',
      ],
      recommendations: [
        {
          title: 'Warm up outbound broadcasts gradually',
          description: 'When launching new campaigns, send in small batches (50–100/hour) to build organic engagement.',
          priority: 'medium',
          impact: 'Maintains sender reputation and avoids sudden carrier throttling.',
        },
        {
          title: 'Ensure verified opt-in for all recipients',
          description: 'Only message contacts who have explicitly agreed to receive WhatsApp communications.',
          priority: 'high',
          impact: 'Prevents customer spam reports and maintains high Meta Quality ratings.',
        },
      ],
      analyzedAt: new Date().toISOString(),
      engine: 'heuristic',
    };
  }

  // Calculate weighted score (0 to 100)
  // Delivery quality: 35% weight
  let deliveryScore = Math.min(35, (deliveryRate / 100) * 35);
  if (failureRate > 10) deliveryScore = Math.max(0, deliveryScore - 15);
  else if (failureRate > 5) deliveryScore = Math.max(0, deliveryScore - 8);

  // Read rate / Open quality: 30% weight
  const readScore = Math.min(30, (readRate / 100) * 30);

  // Reply / Two-way conversational engagement: 25% weight
  // In WhatsApp marketing, 15%+ reply rate is phenomenal, so we scale replyRate up to 25%
  const scaledReplyFactor = Math.min(1, replyRate / 20);
  const replyScore = scaledReplyFactor * 25;

  // Reputation Baseline & Campaign Stability: 10% weight
  let stabilityScore = 10;
  if (metaQualityRating === 'RED') stabilityScore = 0;
  else if (metaQualityRating === 'YELLOW') stabilityScore = 4;
  else if (metaQualityRating === 'GREEN') stabilityScore = 10;

  let rawTotal = deliveryScore + readScore + replyScore + stabilityScore;
  const healthScore = Math.max(10, Math.min(100, Math.round(rawTotal)));

  let healthStatus: AIHealthAnalysisResult['healthStatus'] = 'GOOD';
  let riskLevel: AIHealthAnalysisResult['riskLevel'] = 'LOW';

  if (healthScore >= 88) {
    healthStatus = 'EXCELLENT';
    riskLevel = 'LOW';
  } else if (healthScore >= 74) {
    healthStatus = 'GOOD';
    riskLevel = 'LOW';
  } else if (healthScore >= 60) {
    healthStatus = 'FAIR';
    riskLevel = 'MEDIUM';
  } else if (healthScore >= 42) {
    healthStatus = 'POOR';
    riskLevel = 'HIGH';
  } else {
    healthStatus = 'CRITICAL';
    riskLevel = 'CRITICAL';
  }

  const positiveFactors: string[] = [];
  const riskFactors: string[] = [];
  const recommendations: HealthRecommendation[] = [];

  // Positives
  if (deliveryRate >= 95) positiveFactors.push(`High delivery success rate (${deliveryRate.toFixed(1)}%) across active networks.`);
  if (readRate >= 75) positiveFactors.push(`Outstanding open and read rate (${readRate.toFixed(1)}%), signaling relevant content.`);
  if (replyRate >= 12) positiveFactors.push(`Strong bidirectional engagement with a ${replyRate.toFixed(1)}% user response rate.`);
  if (failureRate <= 2) positiveFactors.push(`Very low message bounce/failure rate (${failureRate.toFixed(1)}%).`);
  if (metaQualityRating === 'GREEN') positiveFactors.push('Official Meta Quality Rating is verified GREEN (High Quality).');

  // Risks
  if (failureRate > 5) riskFactors.push(`High delivery failure rate (${failureRate.toFixed(1)}%) indicates invalid numbers or recipient blocks.`);
  if (readRate < 45) riskFactors.push(`Low read rate (${readRate.toFixed(1)}%) indicates template fatigue or poor send timings.`);
  if (replyRate < 4 && totalSent > 50) riskFactors.push(`Low customer response rate (${replyRate.toFixed(1)}%) creates higher risk of spam reports.`);
  if (metaQualityRating === 'YELLOW' || metaQualityRating === 'RED') riskFactors.push(`Meta official quality status is flagged as ${metaQualityRating}. Immediate mitigation required.`);

  if (positiveFactors.length === 0) {
    positiveFactors.push('Active WhatsApp routing established and transmitting messages.');
  }
  if (riskFactors.length === 0) {
    riskFactors.push('No critical vulnerabilities or anomalous bounce spikes detected.');
  }

  // Recommendations
  if (failureRate > 5) {
    recommendations.push({
      title: 'Scrub invalid phone numbers and inactive contacts',
      description: 'High failure rates trigger WhatsApp spam heuristics. Clean contact lists to ensure all numbers are active on WhatsApp.',
      priority: 'high',
      impact: 'Reduces bounce penalties by up to 80% and protects phone number reputation.',
    });
  }

  if (replyRate < 8) {
    recommendations.push({
      title: 'Add interactive quick-reply buttons to templates',
      description: 'Encourage customer responses with clear Call-to-Action (CTA) or Quick Reply buttons on outgoing broadcasts.',
      priority: 'high',
      impact: 'Drives two-way conversational engagement which signals genuine user interest to WhatsApp algorithms.',
    });
  }

  if (readRate < 60) {
    recommendations.push({
      title: 'Optimize broadcast delivery schedules',
      description: 'Analyze peak activity hours in reports and align campaign dispatch during hours when your audience is active.',
      priority: 'medium',
      impact: 'Increases message open rates and prevents message burying.',
    });
  }

  recommendations.push({
    title: 'Maintain healthy opt-out mechanisms',
    description: 'Always include a polite "Reply STOP to unsubscribe" option in promotional marketing messages.',
    priority: 'medium',
    impact: 'Directs disinterested users to unsubscribe rather than clicking WhatsApp "Report as Spam".',
  });

  return {
    healthScore,
    healthStatus,
    riskLevel,
    engagementQuality:
      replyRate >= 15
        ? 'Superb two-way conversational engagement.'
        : replyRate >= 8
        ? 'Healthy response interaction from recipients.'
        : 'Moderate engagement; predominantly one-way outreach.',
    deliveryQuality:
      deliveryRate >= 95
        ? 'Excellent carrier transmission with minimal bounces.'
        : deliveryRate >= 85
        ? 'Good delivery performance with minor undelivered exceptions.'
        : 'Suboptimal delivery rate; list sanitization advised.',
    userResponseQuality: `${replyRate.toFixed(1)}% response rate with ${metrics.repliedUsersCount} engaging users.`,
    campaignPerformance:
      metrics.campaigns.length > 0
        ? `${metrics.campaigns.length} campaigns evaluated with average read rate of ${readRate.toFixed(1)}%.`
        : 'No broadcast campaigns active in this date window.',
    positiveFactors,
    riskFactors,
    recommendations,
    analyzedAt: new Date().toISOString(),
    engine: 'heuristic',
  };
}

/**
 * Executes AI-based evaluation of the WhatsApp messaging health using Google Gemini
 * or OpenAI fallback, with automatic degradation to the heuristic engine if no key exists.
 */
export async function analyzeWhatsAppHealthWithAI(
  metrics: HealthMetricsInput,
  organizationId: string
): Promise<AIHealthAnalysisResult> {
  try {
    // 1. Resolve AI API key (System Config or Org Key)
    let apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      const config = await prisma.systemConfig.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { aiProviderApiKey: true },
      });
      apiKey = config?.aiProviderApiKey || '';
    }

    if (!apiKey) {
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { aiApiKeys: true },
      });
      if (org?.aiApiKeys && typeof org.aiApiKeys === 'object') {
        apiKey = (org.aiApiKeys as Record<string, string>)['gemini'] || '';
      }
    }

    // If Gemini key is available, use Google Generative AI
    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json',
        },
      });

      const prompt = `You are a WhatsApp Business API & Sender Reputation Health Auditor.
Evaluate the following WhatsApp messaging and campaign performance telemetry from an active business account:

### TELEMETRY SNAPSHOT (Last ${metrics.periodDays} days):
- Total Outbound Messages Sent: ${metrics.totalSent}
- Successfully Delivered: ${metrics.deliveredCount} (${metrics.deliveryRate.toFixed(1)}%)
- Messages Read: ${metrics.readCount} (${metrics.readRate.toFixed(1)}%)
- Total Failed/Bounced: ${metrics.failedCount} (${metrics.failureRate.toFixed(1)}%)
- Users Who Replied: ${metrics.repliedUsersCount} (${metrics.replyRate.toFixed(1)}% of reached users)
- Users Who Did Not Reply: ${metrics.notRepliedUsersCount}
- Ignored/Unread Messages: ${metrics.ignoredMessagesCount} (${metrics.ignoreRate.toFixed(1)}%)
- Active Campaigns Count: ${metrics.activeCampaignsCount}
- Official Meta Quality Rating: ${metrics.metaQualityRating || 'UNKNOWN/N/A'}
- Connection Method: ${metrics.whatsappConnectionMethod || 'manual'}
- Top Campaigns Performance:
${metrics.campaigns.slice(0, 5).map(c => `  * "${c.name}": Sent=${c.sent}, Delivered=${c.delivered} (${c.deliveryRate.toFixed(1)}%), Read=${c.read} (${c.readRate.toFixed(1)}%), Replied=${c.replied}`).join('\n') || '  (No campaigns)'}

### INSTRUCTIONS:
Calculate an **AI Estimated Health Score (0–100)** evaluating the risk of spam flags, block probability, and overall messaging reputation.
Do NOT pretend to be official Meta. You are providing our internal AI health estimation.

Return ONLY a valid JSON object matching this schema:
{
  "healthScore": number, // 0 to 100
  "healthStatus": "EXCELLENT" | "GOOD" | "FAIR" | "POOR" | "CRITICAL",
  "riskLevel": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "engagementQuality": "string concise summary",
  "deliveryQuality": "string concise summary",
  "userResponseQuality": "string concise summary",
  "campaignPerformance": "string concise summary",
  "positiveFactors": ["string", "string", ...],
  "riskFactors": ["string", "string", ...],
  "recommendations": [
    {
      "title": "string action item",
      "description": "string detail",
      "priority": "high" | "medium" | "low",
      "impact": "string expected outcome"
    }
  ]
}`;

      const result = await model.generateContent(prompt);
      const text = result.response.text();
      const parsed = JSON.parse(text);

      return {
        healthScore: typeof parsed.healthScore === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.healthScore))) : 75,
        healthStatus: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'].includes(parsed.healthStatus) ? parsed.healthStatus : 'GOOD',
        riskLevel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(parsed.riskLevel) ? parsed.riskLevel : 'LOW',
        engagementQuality: parsed.engagementQuality || 'Good engagement quality',
        deliveryQuality: parsed.deliveryQuality || 'Standard delivery transmission',
        userResponseQuality: parsed.userResponseQuality || 'Healthy customer responses',
        campaignPerformance: parsed.campaignPerformance || 'Active campaign distribution',
        positiveFactors: Array.isArray(parsed.positiveFactors) ? parsed.positiveFactors : [],
        riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
        analyzedAt: new Date().toISOString(),
        engine: 'ai',
      };
    }

    // OpenAI Fallback if configured
    if (process.env.OPENAI_API_KEY) {
      const { getAIResponse } = await import('@/lib/ai/openai');
      const prompt = `Analyze WhatsApp Business sender reputation. Return JSON strictly matching:
{"healthScore": number, "healthStatus": "EXCELLENT"|"GOOD"|"FAIR"|"POOR"|"CRITICAL", "riskLevel": "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", "engagementQuality": string, "deliveryQuality": string, "userResponseQuality": string, "campaignPerformance": string, "positiveFactors": string[], "riskFactors": string[], "recommendations": [{"title": string, "description": string, "priority": "high"|"medium"|"low", "impact": string}]}.
Data: Sent=${metrics.totalSent}, Delivered=${metrics.deliveredCount} (${metrics.deliveryRate.toFixed(1)}%), Read=${metrics.readCount} (${metrics.readRate.toFixed(1)}%), Replied=${metrics.repliedUsersCount} (${metrics.replyRate.toFixed(1)}%), Failed=${metrics.failedCount} (${metrics.failureRate.toFixed(1)}%), Meta Quality=${metrics.metaQualityRating || 'UNKNOWN'}.`;

      const response = await getAIResponse(prompt, { organizationId });
      if (response) {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            healthScore: Math.max(0, Math.min(100, Math.round(parsed.healthScore || 75))),
            healthStatus: parsed.healthStatus || 'GOOD',
            riskLevel: parsed.riskLevel || 'LOW',
            engagementQuality: parsed.engagementQuality || 'Good engagement',
            deliveryQuality: parsed.deliveryQuality || 'Stable delivery',
            userResponseQuality: parsed.userResponseQuality || 'Normal response rate',
            campaignPerformance: parsed.campaignPerformance || 'Campaign performance normal',
            positiveFactors: parsed.positiveFactors || [],
            riskFactors: parsed.riskFactors || [],
            recommendations: parsed.recommendations || [],
            analyzedAt: new Date().toISOString(),
            engine: 'ai',
          };
        }
      }
    }
  } catch (error) {
    console.error('[HealthAnalyzer] AI inference failed, falling back to heuristic engine:', error);
  }

  // Graceful fallback to heuristic algorithm
  return calculateHeuristicHealthAudit(metrics);
}
