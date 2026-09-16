"use client"

import React, { useState, useEffect } from 'react'
import { getAdLeadsReport } from '@/app/actions/leads'
import DashboardLayoutClient from '@/components/dashboard/DashboardLayoutClient'
import { 
  BarChart, 
  Users, 
  MessageSquare, 
  Calendar, 
  Search, 
  Download, 
  ArrowUpRight,
  Target,
  Facebook,
  Instagram,
  RefreshCcw
} from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export default function LeadsReportPage() {
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPlatform, setFilterPlatform] = useState('all')

  useEffect(() => {
    loadLeads()
  }, [])

  const loadLeads = async () => {
    try {
      setLoading(true)
      const data = await getAdLeadsReport()
      setLeads(data)
    } catch (error) {
      console.error("Failed to load leads:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = lead.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         lead.waId?.includes(searchTerm);
    
    const isInstagram = lead.referral?.source_url?.includes('instagram.com');
    const matchesPlatform = filterPlatform === 'all' || 
                           (filterPlatform === 'instagram' && isInstagram) ||
                           (filterPlatform === 'facebook' && !isInstagram);
    
    return matchesSearch && matchesPlatform;
  })

  const downloadCSV = () => {
    const headers = ["Date", "Name", "Number", "Message", "Ad Headline", "Ad Link"]
    const rows = leads.map(l => [
      format(new Date(l.createdAt), 'yyyy-MM-dd HH:mm'),
      l.contactName,
      l.waId,
      l.message,
      l.referral?.headline || '',
      l.referral?.source_url || ''
    ])

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n"
      + rows.map(e => e.join(",")).join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `ads_leads_${format(new Date(), 'yyyy_MM_dd')}.csv`)
    document.body.appendChild(link)
    link.click()
  }

  const todayLeadsCount = leads.filter(l => format(new Date(l.createdAt), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).length

  return (
    <DashboardLayoutClient mainClassName="bg-[#F8FAFC] dark:bg-slate-950 min-h-screen relative overflow-x-hidden font-[family-name:var(--dashboard-font)] transition-colors duration-300">
      <div className="max-w-[1400px] mx-auto space-y-8 pb-20 px-4 md:px-8 pt-4">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#00B074] dark:text-emerald-400">
              <Target className="w-4 h-4" />
              <span className="text-xs font-black tracking-widest uppercase">Marketing Intelligence</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Ad Leads Report</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">
              Track and analyze high-intent prospects originating from your Meta campaigns.
            </p>
          </div>
          
          <Button 
            onClick={downloadCSV}
            className="bg-[#00B074] hover:bg-[#009662] text-white font-bold h-11 px-6 rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-[#00B074]/20 flex items-center gap-2 shrink-0 self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            Export to CSV
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Total Leads */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
            <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#EEF2FF] dark:bg-blue-500/10 flex items-center justify-center text-[#2F63FF] shrink-0">
              <Users className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Total Leads</span>
              <span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none block">
                {leads.length}
              </span>
            </div>
          </div>

          {/* Today's Leads */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
            <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#FFF9EC] dark:bg-amber-500/10 flex items-center justify-center text-[#F59E0B] shrink-0">
              <Calendar className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Today's Leads</span>
              <span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none block">
                {todayLeadsCount}
              </span>
            </div>
          </div>

          {/* Conversion Insights */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 xl:p-5 border border-slate-100 dark:border-slate-800/60 shadow-sm flex items-center gap-3.5 xl:gap-4 min-w-0">
            <div className="w-12 h-12 xl:w-14 xl:h-14 rounded-full bg-[#E8F8F2] dark:bg-emerald-500/10 flex items-center justify-center text-[#00B074] shrink-0">
              <BarChart className="w-5.5 h-5.5 xl:w-6 xl:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] xl:text-[11px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-0.5 truncate">Active Conversion</span>
              <span className="text-2xl xl:text-[28px] font-black text-slate-950 dark:text-white leading-none block">
                12.5%
              </span>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-100 dark:border-slate-800/60 shadow-sm overflow-hidden">
          {/* Table Controls */}
          <div className="p-6 border-b border-gray-100 dark:border-slate-800/60 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  type="text" 
                  placeholder="Search by name or number..."
                  className="w-full bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-800 py-3 pl-10 pr-4 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all font-medium rounded-xl h-11"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <select 
                className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl py-2.5 px-4 outline-none transition-all text-slate-600 dark:text-slate-300 font-bold text-xs uppercase tracking-wider min-w-[180px] h-11 shadow-sm"
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
              >
                <option value="all">All Platforms</option>
                <option value="facebook">Facebook Ads Only</option>
                <option value="instagram">Instagram Ads Only</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00B074] animate-pulse"></div>
              Live Tracking Active
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 text-xs font-bold uppercase tracking-widest border-b border-gray-100 dark:border-slate-800">
                  <th className="px-6 py-4">Lead Source</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Ad Campaign</th>
                  <th className="px-6 py-4">Initial Message</th>
                  <th className="px-6 py-4 text-right">Acquired</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <RefreshCcw className="w-8 h-8 animate-spin text-[#00B074]" />
                        <span>Decrypting lead data...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center text-slate-400 font-medium">
                      No leads found matching your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const isInstagram = lead.referral?.source_url?.includes('instagram.com');
                    return (
                      <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-xl flex items-center justify-center shrink-0",
                              isInstagram ? 'bg-pink-50 dark:bg-pink-900/10' : 'bg-blue-50 dark:bg-blue-900/10'
                            )}>
                              {isInstagram ? (
                                <Instagram className="w-4 h-4 text-pink-500" />
                              ) : (
                                <Facebook className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <span className="font-bold text-sm text-slate-900 dark:text-white">
                              {isInstagram ? 'Instagram Ad' : 'Facebook Ad'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white">{lead.contactName || 'Anonymous User'}</span>
                            <span className="text-xs text-slate-500 font-medium">{lead.waId}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <div className="flex flex-col">
                            <span className="text-[#00B074] dark:text-emerald-400 font-bold text-sm truncate">{lead.referral?.headline || 'Direct Interaction'}</span>
                            {lead.referral?.source_url && (
                              <a 
                                href={lead.referral?.source_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-[10px] text-slate-400 hover:text-[#00B074] flex items-center gap-1 transition-colors font-bold uppercase tracking-wider mt-0.5"
                              >
                                View Creative <ArrowUpRight className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl px-4 py-2.5 text-sm text-slate-600 dark:text-slate-400 font-medium border border-gray-100 dark:border-slate-800/40 italic">
                            "{lead.message || 'No message content'}"
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">{format(new Date(lead.createdAt), 'MMM d, hh:mm a')}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayoutClient>
  )
}
