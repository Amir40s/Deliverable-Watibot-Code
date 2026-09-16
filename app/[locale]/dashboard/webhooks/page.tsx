"use client"

import { useState, useEffect } from "react"
import DashboardLayoutClient from "@/components/dashboard/DashboardLayoutClient"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import {
  Webhook,
  Plus,
  Trash2,
  RefreshCw,
  Copy,
  ExternalLink,
  Activity,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
  Check,
  BookOpen,
  Terminal,
  Pencil,
  Sparkles
} from "lucide-react"
import {
  getWebhooks,
  createWebhook,
  deleteWebhook,
  updateWebhook,
  regenerateWebhookSecret,
  verifyWebhookUrl
} from "@/app/actions/webhooks"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

const AVAILABLE_EVENTS = [
  { id: "contact.created", label: "New Contact Created" },
  { id: "contact.updated", label: "Contact Updated" },
  { id: "contact.deleted", label: "Contact Deleted" },
  { id: "message.received", label: "Inbound Message Received" },
  { id: "message.sent", label: "Outbound Message Sent" },
  { id: "message.delivered", label: "Message Delivered" },
  { id: "message.read", label: "Message Read" },
  { id: "flow.started", label: "Flow Execution Started" },
  { id: "flow.completed", label: "Flow Execution Completed" },
  { id: "campaign.started", label: "Campaign Started" },
  { id: "campaign.completed", label: "Campaign Completed" },
  { id: "note.added", label: "Note Added to Contact" },
  { id: "tag.assigned", label: "Tag Assigned to Contact" },
  { id: "tag.removed", label: "Tag Removed from Contact" }
]

const EVENT_PAYLOADS: Record<string, any> = {
  "contact.created": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "contact.created",
    "timestamp": "2026-06-16T12:00:00Z",
    "data": {
      "id": "cnt_987654",
      "name": "Jane Smith",
      "phone": "+1234567890",
      "source": "api"
    }
  },
  "contact.updated": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "contact.updated",
    "timestamp": "2026-06-16T12:05:00Z",
    "data": {
      "id": "cnt_987654",
      "changes": {
        "name": "Jane Doe"
      }
    }
  },
  "contact.deleted": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "contact.deleted",
    "timestamp": "2026-06-16T12:10:00Z",
    "data": {
      "id": "cnt_987654",
      "phone": "+1234567890"
    }
  },
  "message.received": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "message.received",
    "timestamp": "2026-06-16T12:00:00Z",
    "data": {
      "message_id": "msg_112233",
      "contact_id": "cnt_987654",
      "from": "+1234567890",
      "type": "text",
      "text": "I'd like to buy a subscription.",
      "media_url": null
    }
  },
  "message.sent": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "message.sent",
    "timestamp": "2026-06-16T12:01:00Z",
    "data": {
      "message_id": "msg_445566",
      "contact_id": "cnt_987654",
      "to": "+1234567890",
      "type": "text",
      "text": "Great! Here is the link..."
    }
  },
  "message.delivered": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "message.delivered",
    "timestamp": "2026-06-16T12:01:05Z",
    "data": {
      "message_id": "msg_445566",
      "contact_id": "cnt_987654"
    }
  },
  "message.read": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "message.read",
    "timestamp": "2026-06-16T12:05:10Z",
    "data": {
      "message_id": "msg_445566",
      "contact_id": "cnt_987654"
    }
  },
  "flow.started": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "flow.started",
    "timestamp": "2026-06-16T12:00:00Z",
    "data": {
      "flow_id": "flw_xxyyzz",
      "flow_name": "Support Ticket Flow",
      "contact_id": "cnt_987654"
    }
  },
  "flow.completed": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "flow.completed",
    "timestamp": "2026-06-16T12:05:00Z",
    "data": {
      "flow_id": "flw_xxyyzz",
      "contact_id": "cnt_987654",
      "variables": {
        "issue_type": "billing",
        "priority": "high"
      }
    }
  },
  "campaign.started": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "campaign.started",
    "timestamp": "2026-06-16T12:00:00Z",
    "data": {
      "campaign_id": "cmp_blackfriday",
      "campaign_name": "Black Friday Promo",
      "total_contacts": 2500
    }
  },
  "campaign.completed": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "campaign.completed",
    "timestamp": "2026-06-16T14:00:00Z",
    "data": {
      "campaign_id": "cmp_blackfriday",
      "successful_sends": 2490,
      "failed": 10
    }
  },
  "note.added": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "note.added",
    "timestamp": "2026-06-16T12:00:00Z",
    "data": {
      "contact_id": "cnt_987654",
      "agent_id": "usr_9988",
      "note": "Client wants to upgrade next week."
    }
  },
  "tag.assigned": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "tag.assigned",
    "timestamp": "2026-06-16T12:00:00Z",
    "data": {
      "contact_id": "cnt_987654",
      "tag_id": "tag_hotlead",
      "tag_name": "Hot Lead"
    }
  },
  "tag.removed": {
    "webhook_id": "wh_a1b2c3d4",
    "event": "tag.removed",
    "timestamp": "2026-06-16T12:00:00Z",
    "data": {
      "contact_id": "cnt_987654",
      "tag_id": "tag_hotlead",
      "tag_name": "Hot Lead"
    }
  }
}

const INBOUND_PAYLOADS: Record<string, any> = {
  "contact.created": {
    "action": "create_contact",
    "name": "Jane Smith",
    "phone": "+1234567890",
    "email": "jane@example.com"
  },
  "contact.updated": {
    "action": "update_contact",
    "contact_id": "cnt_987654",
    "name": "Jane Doe",
    "custom_fields": {
      "company": "Acme Corp"
    }
  },
  "contact.deleted": {
    "action": "delete_contact",
    "contact_id": "cnt_987654"
  },
  "message.received": {
    "action": "send_message",
    "phone": "+1234567890",
    "message": "Hello from external app!",
    "media_url": "https://example.com/image.png"
  },
  "message.sent": {
    "action": "send_template",
    "phone": "+1234567890",
    "template_name": "welcome_message",
    "language": "en_US",
    "parameters": {
      "body": ["John", "Zapier"]
    }
  },
  "message.delivered": {
    "action": "send_message",
    "phone": "+1234567890",
    "message": "Hello from external app!"
  },
  "message.read": {
    "action": "send_message",
    "phone": "+1234567890",
    "message": "Hello from external app!"
  },
  "flow.started": {
    "action": "start_flow",
    "flow_id": "flw_xxyyzz",
    "contact_id": "cnt_987654",
    "variables": {
      "discount_code": "SAVE20"
    }
  },
  "flow.completed": {
    "action": "start_flow",
    "flow_id": "flw_xxyyzz",
    "contact_id": "cnt_987654"
  },
  "campaign.started": {
    "action": "start_campaign",
    "campaign_id": "cmp_blackfriday"
  },
  "campaign.completed": {
    "action": "start_campaign",
    "campaign_id": "cmp_blackfriday"
  },
  "note.added": {
    "action": "add_note",
    "contact_id": "cnt_987654",
    "note": "Follow up requested by external system."
  },
  "tag.assigned": {
    "action": "assign_tag",
    "contact_id": "cnt_987654",
    "tag_id": "tag_hotlead"
  },
  "tag.removed": {
    "action": "remove_tag",
    "contact_id": "cnt_987654",
    "tag_id": "tag_hotlead"
  }
}

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [selectedEvents, setSelectedEvents] = useState<string[]>(["contact.created", "message.received"])
  const [isAiAgentInput, setIsAiAgentInput] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isDocsOpen, setIsDocsOpen] = useState(false)
  const [selectedDocEvent, setSelectedDocEvent] = useState("contact.created")

  const [isSaving, setIsSaving] = useState(false)
  const [urlStatus, setUrlStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [urlErrorMsg, setUrlErrorMsg] = useState("")

  useEffect(() => {
    fetchWebhooks()
  }, [])

  const fetchWebhooks = async () => {
    setIsLoading(true)
    const data = await getWebhooks()
    setWebhooks(data)
    setIsLoading(false)
  }

  const handleOpenModal = (webhook?: any) => {
    setUrlStatus('idle')
    setUrlErrorMsg("")
    setIsDropdownOpen(false)

    if (webhook) {
      setEditingId(webhook.id)
      setNameInput(webhook.name)
      setUrlInput(webhook.targetUrl)
      setSelectedEvents(webhook.events || [])
      setIsAiAgentInput(!!webhook.isAiAgent)
    } else {
      setEditingId(null)
      setNameInput("")
      setUrlInput("")
      setSelectedEvents(["contact.created", "message.received"])
      setIsAiAgentInput(false)
    }
    setIsModalOpen(true)
  }

  const toggleEvent = (eventId: string) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(e => e !== eventId)
        : [...prev, eventId]
    )
  }

  const handleSave = async () => {
    if (!nameInput.trim()) {
      toast.error("Please provide a webhook name.")
      return
    }

    if (selectedEvents.length === 0) {
      toast.error("Please select at least one event trigger.")
      return
    }

    setIsSaving(true)
    setUrlStatus('idle')
    setUrlErrorMsg("")

    const trimmedUrl = urlInput.trim()

    if (trimmedUrl) {
      const verifyRes = await verifyWebhookUrl(trimmedUrl)
      
      if (verifyRes.error) {
        setIsSaving(false)
        setUrlStatus('error')
        setUrlErrorMsg(verifyRes.error)
        toast.error(verifyRes.error)
        return
      }

      setUrlStatus('success')
    }

    if (editingId) {
      const res = await updateWebhook(editingId, nameInput, trimmedUrl, selectedEvents, true, isAiAgentInput)
      if (res.error) toast.error(res.error)
      else toast.success("Webhook updated successfully.")
    } else {
      const res = await createWebhook(nameInput, trimmedUrl, selectedEvents, isAiAgentInput)
      if (res.error) toast.error(res.error)
      else toast.success("Webhook created successfully.")
    }

    setIsSaving(false)
    setIsModalOpen(false)
    fetchWebhooks()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return
    const res = await deleteWebhook(id)
    if (res.error) toast.error(res.error)
    else {
      toast.success("Webhook deleted successfully.")
      fetchWebhooks()
    }
  }

  const handleRegenerate = async (id: string) => {
    if (!confirm("Regenerating the secret will break existing external connections using it. Continue?")) return
    const res = await regenerateWebhookSecret(id)
    if (res.error) toast.error(res.error)
    else {
      toast.success("Secret regenerated successfully.")
      fetchWebhooks()
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast.success(`${type} copied to clipboard!`)
      } else {
        const textArea = document.createElement("textarea")
        textArea.value = text
        
        textArea.style.top = "0"
        textArea.style.left = "0"
        textArea.style.position = "fixed"
        textArea.style.opacity = "0"
        
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        
        if (successful) {
          toast.success(`${type} copied to clipboard!`)
        } else {
          toast.error("Failed to copy. Please select and copy manually.")
        }
      }
    } catch (err) {
      console.error('Failed to copy text: ', err)
      toast.error("Failed to copy. Please select and copy manually.")
    }
  }

  return (
    <DashboardLayoutClient mainClassName="p-0 bg-slate-50/50 dark:bg-slate-950/20 antialiased h-[calc(100vh-64px)] overflow-hidden transition-colors duration-300">
      <div className="h-full overflow-y-auto p-6 md:p-8 text-start">
        <div className="max-w-[1200px] mx-auto space-y-6">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <Webhook className="w-6 h-6 text-indigo-500" />
                External Webhooks
              </h2>
              <p className="text-sm text-slate-500 font-semibold mt-1">
                Connect CRM events to Zapier, n8n, Zoho, or any external automation platform.
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setIsDocsOpen(true)} variant="outline" className="border-slate-200 gap-2 font-bold rounded-xl text-slate-600 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                <BookOpen className="w-4 h-4" />
                API Docs
              </Button>
              <Button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold rounded-xl">
                <Plus className="w-4 h-4" />
                Create Webhook
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-12">
              <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-12 text-center space-y-4">
              <Activity className="w-12 h-12 text-slate-300 mx-auto stroke-1" />
              <h4 className="text-[16px] font-black text-slate-800 dark:text-white">No webhooks configured</h4>
              <p className="text-sm text-slate-500 max-w-sm mx-auto">
                Set up a webhook to push real-time events to your external tools.
              </p>
              <Button onClick={() => handleOpenModal()} variant="outline" className="border-slate-200">
                Get Started
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {webhooks.map((wh) => {
                const inboundUrl = typeof window !== 'undefined' 
                  ? `${window.location.origin}/api/webhooks/external/${wh.id}`
                  : `/api/webhooks/external/${wh.id}`;

                return (
                  <div key={wh.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-sm relative group">
                    
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                          {wh.name}
                          {wh.isActive ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                          )}
                          {wh.isAiAgent && (
                            <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 hover:bg-violet-100 text-[10px] gap-1 font-bold">
                              <Sparkles className="w-2.5 h-2.5" /> AI Agent
                            </Badge>
                          )}
                        </h3>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate max-w-[200px]">{wh.targetUrl || "None (Inbound only)"}</span>
                        </p>

                      </div>
                      
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenModal(wh)} className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                          <Pencil className="w-4 h-4" />
                          <span className="sr-only">Edit</span>
                        </button>
                        <button onClick={() => handleDelete(wh.id)} className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-3 border border-slate-100 dark:border-slate-800/60">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Inbound Endpoint (Send data to CRM)</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5">
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate flex-1">{inboundUrl}</span>
                          <button onClick={() => copyToClipboard(inboundUrl, 'URL')} className="text-indigo-500 hover:text-indigo-600">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Secret Key (Auth)</label>
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1.5">
                          <span className="text-[11px] font-mono text-slate-600 dark:text-slate-400 truncate flex-1">••••••••••••••••••••••••••••••••</span>
                          <button onClick={() => copyToClipboard(wh.secretKey, 'Secret')} className="text-indigo-500 hover:text-indigo-600" title="Copy Secret">
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleRegenerate(wh.id)} className="text-amber-500 hover:text-amber-600" title="Regenerate Secret">
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-1.5 flex-wrap">
                      {wh.events.map((ev: string) => (
                        <span key={ev} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded text-[10px] font-bold">
                          {ev}
                        </span>
                      ))}
                    </div>

                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Name</label>
              <Input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="e.g. Zapier Integration"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Target URL (Outbound) <span className="text-slate-400 font-normal">(Optional)</span></label>
              <Input

                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value)
                  if (urlStatus !== 'idle') setUrlStatus('idle')
                }}
                placeholder="https://hooks.zapier.com/..."
                className={`rounded-xl ${
                  urlStatus === 'error' ? 'border-red-500 focus-visible:ring-red-500' : ''
                }`}
              />
              {urlStatus === 'error' && <p className="text-[10px] text-red-500 font-semibold">{urlErrorMsg}</p>}
              <p className="text-[10px] text-slate-500">The CRM will POST data to this URL when events occur.</p>
            </div>
            <div className="space-y-2 relative">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Event Triggers</label>
              
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left text-sm font-medium text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <span className="truncate">
                  {selectedEvents.length === 0 
                    ? "Select event triggers..." 
                    : selectedEvents.length === 1 
                      ? AVAILABLE_EVENTS.find(e => e.id === selectedEvents[0])?.label 
                      : `${selectedEvents.length} events selected`}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                  <div className="absolute z-50 top-[70px] left-0 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-[260px] overflow-y-auto py-1.5 animate-in fade-in zoom-in-95 duration-100">
                    {AVAILABLE_EVENTS.map(event => {
                      const isSelected = selectedEvents.includes(event.id);
                      return (
                        <button 
                          key={event.id}
                          type="button"
                          onClick={() => toggleEvent(event.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isSelected ? 'bg-indigo-50/50 dark:bg-indigo-500/10' : ''}`}
                        >
                          <div className="flex flex-col">
                            <span className={`text-[13px] font-semibold ${isSelected ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-200'}`}>
                              {event.label}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono mt-0.5">{event.id}</span>
                          </div>
                          {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
              <p className="text-[10px] text-slate-500 mt-1.5">Select the events that will push data to your webhook.</p>
            </div>

            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 mt-2">
              <Checkbox
                id="isAiAgent"
                checked={isAiAgentInput}
                onCheckedChange={(checked) => setIsAiAgentInput(!!checked)}
                className="mt-0.5 rounded-md"
              />
              <div className="space-y-0.5">
                <label htmlFor="isAiAgent" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                  Act as AI Agent (n8n / AI Integration)
                </label>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Chats processed by this webhook will be linked as AI Agent chats. If a chat disables AI or Webhooks, the AI tag will be removed and placed in Intervented.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)} className="rounded-xl" disabled={isSaving}>Cancel</Button>
            <Button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2" disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDocsOpen} onOpenChange={setIsDocsOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5 text-indigo-500" />
              Webhook API Documentation
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  1. Outbound (CRM to External Tool)
                </h3>
              </div>
              <p className="text-xs text-slate-500">When an event triggers, the CRM sends a POST request to your Target URL. Select an event below to see its specific JSON payload structure:</p>
              
              <div className="flex items-center gap-2 mb-2">
                <label className="text-[11px] font-bold text-slate-500 uppercase">Event Type:</label>
                <select 
                  className="text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
                  value={selectedDocEvent}
                  onChange={(e) => setSelectedDocEvent(e.target.value)}
                >
                  {AVAILABLE_EVENTS.map(ev => (
                    <option key={ev.id} value={ev.id}>{ev.label} ({ev.id})</option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-950 rounded-xl p-4 relative overflow-hidden group">
                <pre className="text-[11px] font-mono text-emerald-400 overflow-x-auto leading-relaxed">
{JSON.stringify(EVENT_PAYLOADS[selectedDocEvent] || EVENT_PAYLOADS["contact.created"], null, 2)}
                </pre>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                2. Inbound (External Tool to CRM)
              </h3>
              <p className="text-xs text-slate-500">To push data or trigger actions inside the CRM from Zapier/n8n, send a POST request to your generated <strong>Inbound Endpoint</strong> and pass the <strong>Secret Key</strong> either via Header or Query string.</p>
              
              <div className="bg-slate-950 rounded-xl p-4 relative overflow-hidden group">
                <pre className="text-[11px] font-mono text-blue-400 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{`curl -X POST https://your-domain.com/api/webhooks/external/[WEBHOOK_ID] \\
-H "Content-Type: application/json" \\
-H "Authorization: Bearer [YOUR_SECRET_KEY]" \\
-d '${JSON.stringify(INBOUND_PAYLOADS[selectedDocEvent] || INBOUND_PAYLOADS["contact.created"], null, 2).replace(/\n/g, '\n  ')}'`}
                </pre>
              </div>
              <p className="text-[10px] text-slate-400 mt-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                <strong className="text-slate-600 dark:text-slate-300">Alternative Auth:</strong> You can also pass the secret in the URL like <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-indigo-500 font-mono">?secret=[YOUR_SECRET_KEY]</code>
              </p>
            </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDocsOpen(false)} className="rounded-xl font-bold">Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayoutClient>
  )
}
