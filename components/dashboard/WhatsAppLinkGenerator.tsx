"use client"

import React, { useState, useCallback, useRef } from "react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import Link from "next/link"

const COUNTRY_CODES = [
  { name: "Pakistan", code: "+92", flag: "🇵🇰" },
  { name: "United States", code: "+1", flag: "🇺🇸" },
  { name: "United Kingdom", code: "+44", flag: "🇬🇧" },
  { name: "India", code: "+91", flag: "🇮🇳" },
  { name: "UAE", code: "+971", flag: "🇦🇪" },
  { name: "Saudi Arabia", code: "+966", flag: "🇸🇦" },
  { name: "Canada", code: "+1", flag: "🇨🇦" },
  { name: "Australia", code: "+61", flag: "🇦🇺" },
  { name: "Germany", code: "+49", flag: "🇩🇪" },
  { name: "France", code: "+33", flag: "🇫🇷" },
]

interface WhatsAppLinkGeneratorProps {
  defaultPhone?: string
  isPage?: boolean
}

export function WhatsAppLinkGenerator({ defaultPhone = "", isPage = false }: WhatsAppLinkGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0])
  const [phoneNumber, setPhoneNumber] = useState(defaultPhone.replace(/^\+92/, "").replace(/\D/g, ""))
  const [customMessage, setCustomMessage] = useState("")
  const [generatedLink, setGeneratedLink] = useState("")
  const [showResult, setShowResult] = useState(false)
  const [showCountryDropdown, setShowCountryDropdown] = useState(false)
  const qrRef = useRef<SVGSVGElement>(null)

  const generateLink = useCallback(() => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter a phone number")
      return
    }
    const cleanPhone = (selectedCountry.code + phoneNumber).replace(/[^0-9+]/g, "").replace(/^\+/, "")
    const encodedMsg = encodeURIComponent(customMessage.trim())
    const link = `https://wa.me/${cleanPhone}${encodedMsg ? `?text=${encodedMsg}` : ""}`
    setGeneratedLink(link)
    setShowResult(true)
  }, [phoneNumber, selectedCountry, customMessage])

  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(generatedLink)
    toast.success("Link copied to clipboard!")
  }, [generatedLink])

  const downloadQR = useCallback(() => {
    const svg = document.getElementById("wa-link-qr-svg")
    if (!svg) return
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    canvas.width = 300
    canvas.height = 300
    const ctx = canvas.getContext("2d")!
    const img = new Image()
    img.onload = () => {
      ctx.fillStyle = "#ffffff"
      ctx.fillRect(0, 0, 300, 300)
      ctx.drawImage(img, 0, 0, 300, 300)
      const link = document.createElement("a")
      link.download = "whatsapp-qr.png"
      link.href = canvas.toDataURL("image/png")
      link.click()
    }
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }, [])

  const reset = () => {
    setShowResult(false)
    setGeneratedLink("")
  }

  const displayPhone = selectedCountry.code + " " + phoneNumber

  if (isPage) {
    return (
      <div className="flex flex-col w-full">
        {/* Header */}
        <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00a884]/10 flex items-center justify-center">
              <svg className="w-5.5 h-5.5 text-[#00a884]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div className="text-start">
              <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">WhatsApp Link Generator</h2>
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold mt-0.5">Create shareable links &amp; QR codes for your WA business number</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="mt-6">
          {!showResult ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 min-h-[500px]">
              {/* Left — form */}
              <div className="flex flex-col gap-6 text-start">
                {/* Phone Number */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp Phone Number</label>
                  <p className="text-[10px] text-slate-400 -mt-1 font-semibold">Select your country code &amp; type your phone number</p>
                  <div className="flex gap-2">
                    {/* Country selector */}
                    <div className="relative">
                      <button
                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                        className="h-11 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:border-[#00a884]/50 transition-colors whitespace-nowrap"
                      >
                        <span>{selectedCountry.flag}</span>
                        <span>{selectedCountry.code}</span>
                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showCountryDropdown && (
                        <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[180px] max-h-48 overflow-y-auto">
                          {COUNTRY_CODES.map((c) => (
                            <button
                              key={c.name}
                              onClick={() => { setSelectedCountry(c); setShowCountryDropdown(false) }}
                              className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left", selectedCountry.name === c.name && "text-[#00a884] font-bold")}
                            >
                              <span>{c.flag}</span>
                              <span className="font-medium text-slate-700 dark:text-slate-300">{c.name}</span>
                              <span className="ml-auto text-slate-400 font-bold">{c.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                      placeholder="3001234567"
                      className="flex-1 h-11 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-[#00a884] transition-colors"
                    />
                  </div>
                </div>

                {/* Custom Message */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    Custom Message <span className="text-base">😊</span>
                  </label>
                  <p className="text-[10px] text-slate-400 -mt-1 font-semibold">Type your custom message with emojis &amp; WhatsApp text formatting</p>
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Hi! I'd like to know more about your services..."
                    rows={6}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-[#00a884] transition-colors resize-none"
                  />
                </div>

                <button
                  onClick={generateLink}
                  className="mt-4 w-full h-11 bg-[#00a884] hover:bg-[#008f70] active:scale-[0.98] text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Generate Link
                </button>
              </div>

              {/* Right — preview */}
              <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-3xl p-6 flex flex-col gap-3">
                <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase text-start">Message Preview</span>

                {/* Phone mockup */}
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col min-h-[380px]">
                  {/* Phone header */}
                  <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                      </svg>
                    </div>
                    <span className="text-white text-xs font-bold">{phoneNumber ? displayPhone : "Enter phone number"}</span>
                  </div>
                  {/* Chat area */}
                  <div className="flex-1 bg-[#ece5dd] dark:bg-[#1a1a1a] p-3 flex flex-col justify-end gap-2 text-start">
                    {customMessage && (
                      <div className="self-end bg-[#dcf8c6] dark:bg-[#056162] rounded-xl rounded-br-sm px-3 py-2 max-w-[80%] shadow-sm">
                        <p className="text-xs text-slate-800 dark:text-white whitespace-pre-wrap break-words leading-relaxed">{customMessage}</p>
                      </div>
                    )}
                  </div>
                  {/* Input bar */}
                  <div className="bg-white dark:bg-slate-800 px-3 py-2.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400 flex-1 text-start">Type a message</span>
                    <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center">
                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Result panel */
            <div className="flex flex-col items-center gap-6 p-8">
              <div className="text-center">
                <h3 className="text-lg font-black text-slate-800 dark:text-white">Here is your WhatsApp link! 🎉</h3>
                <p className="text-[11px] text-slate-400 mt-1">Copy and share it on social media, website, emails or anywhere you want to be contacted by your customers.</p>
              </div>

              {/* Link display */}
              <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 w-full max-w-lg border border-slate-200 dark:border-slate-700">
                <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="#25D366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                <a href={generatedLink} target="_blank" rel="noopener noreferrer" className="text-[#00a884] font-bold text-sm hover:underline truncate flex-1 text-start">
                  {generatedLink.replace("https://", "")}
                </a>
              </div>

              {/* QR Code */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <QRCodeSVG
                  id="wa-link-qr-svg"
                  value={generatedLink}
                  size={200}
                  level="H"
                  includeMargin={false}
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 w-full max-w-lg">
                <button
                  onClick={copyLink}
                  className="flex-1 h-11 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-black rounded-xl transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy URL
                </button>
                <button
                  onClick={downloadQR}
                  className="flex-1 h-11 bg-white dark:bg-slate-800 border border-[#00a884] text-[#00a884] text-xs font-black rounded-xl transition-all active:scale-[0.98] hover:bg-[#00a884]/5 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download QR
                </button>
              </div>

              <button onClick={reset} className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors">
                ← Generate another link
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <Link href="/dashboard/whatsapp-link" className="block">
        <div
          className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[24px] cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-md transition-all duration-300 group flex flex-row items-center p-3 gap-5"
        >
          <div className="w-24 h-24 shrink-0 bg-[#fafafa] dark:bg-slate-800/30 rounded-[18px] flex items-center justify-center overflow-hidden border border-slate-50 dark:border-slate-700/50">
            <img 
              src="/whatsappLinkGenerator.png" 
              alt="WhatsApp Link Generator" 
              className="w-20 h-20 object-contain group-hover:scale-105 transition-transform duration-500" 
            />
          </div>
          <div className="flex flex-col text-start py-2 pr-4 min-w-0">
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white tracking-tight">Customize WhatsApp Link</h3>
            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">Create shareable links & QR for your WA business number</p>
          </div>
        </div>
      </Link>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setIsOpen(false) }}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          {/* Modal panel */}
          <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#00a884]/10 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[#00a884]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-800 dark:text-white tracking-tight">WhatsApp Link Generator</h2>
                  <p className="text-[10px] text-slate-400 font-medium">Create shareable links &amp; QR codes for your WA business number</p>
                </div>
              </div>
              <button
                onClick={() => { setIsOpen(false); reset() }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">
              {!showResult ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 min-h-[500px]">
                  {/* Left — form */}
                  <div className="p-6 flex flex-col gap-6">
                    {/* Phone Number */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp Phone Number</label>
                      <p className="text-[10px] text-slate-400 -mt-1">Select your country code &amp; type your phone number</p>
                      <div className="flex gap-2">
                        {/* Country selector */}
                        <div className="relative">
                          <button
                            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                            className="h-11 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 hover:border-[#00a884]/50 transition-colors whitespace-nowrap"
                          >
                            <span>{selectedCountry.flag}</span>
                            <span>{selectedCountry.code}</span>
                            <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showCountryDropdown && (
                            <div className="absolute top-full left-0 mt-1 z-20 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 min-w-[180px] max-h-48 overflow-y-auto">
                              {COUNTRY_CODES.map((c) => (
                                <button
                                  key={c.name}
                                  onClick={() => { setSelectedCountry(c); setShowCountryDropdown(false) }}
                                  className={cn("w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left", selectedCountry.name === c.name && "text-[#00a884] font-bold")}
                                >
                                  <span>{c.flag}</span>
                                  <span className="font-medium text-slate-700 dark:text-slate-300">{c.name}</span>
                                  <span className="ml-auto text-slate-400 font-bold">{c.code}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                          placeholder="3001234567"
                          className="flex-1 h-11 px-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-[#00a884] transition-colors"
                        />
                      </div>
                    </div>

                    {/* Custom Message */}
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        Custom Message <span className="text-base"></span>
                      </label>
                      <p className="text-[10px] text-slate-400 -mt-1">Type your custom message with emojis &amp; WhatsApp text formatting</p>
                      <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Hi! I'd like to know more about your services..."
                        rows={4}
                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-[#00a884] transition-colors resize-none"
                      />
                    </div>

                    <button
                      onClick={generateLink}
                      className="mt-auto w-full h-11 bg-[#00a884] hover:bg-[#008f70] active:scale-[0.98] text-white text-xs font-black rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Generate Link
                    </button>
                  </div>

                  {/* Right — preview */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 border-l border-slate-100 dark:border-slate-800 p-6 flex flex-col gap-3">
                    <span className="text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">Message Preview</span>

                    {/* Phone mockup */}
                    <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm flex flex-col min-h-[380px]">
                      {/* Phone header */}
                      <div className="bg-[#075E54] px-4 py-3 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                          </svg>
                        </div>
                        <span className="text-white text-xs font-bold">{phoneNumber ? displayPhone : "Enter phone number"}</span>
                      </div>
                      {/* Chat area */}
                      <div className="flex-1 bg-[#ece5dd] dark:bg-[#1a1a1a] p-3 flex flex-col justify-end gap-2">
                        {customMessage && (
                          <div className="self-end bg-[#dcf8c6] dark:bg-[#056162] rounded-xl rounded-br-sm px-3 py-2 max-w-[80%] shadow-sm">
                            <p className="text-xs text-slate-800 dark:text-white whitespace-pre-wrap break-words leading-relaxed">{customMessage}</p>
                          </div>
                        )}
                      </div>
                      {/* Input bar */}
                      <div className="bg-white dark:bg-slate-800 px-3 py-2.5 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700">
                        <span className="text-[10px] text-slate-400 flex-1">Type a message</span>
                        <div className="w-7 h-7 rounded-full bg-[#00a884] flex items-center justify-center">
                          <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Result panel */
                <div className="flex flex-col items-center gap-6 p-8">
                  <div className="text-center">
                    <h3 className="text-lg font-black text-slate-800 dark:text-white">Here is your WhatsApp link! 🎉</h3>
                    <p className="text-[11px] text-slate-400 mt-1">Copy and share it on social media, website, emails or anywhere you want to be contacted by your customers.</p>
                  </div>

                  {/* Link display */}
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 rounded-2xl px-4 py-3 w-full max-w-lg border border-slate-200 dark:border-slate-700">
                    <svg className="w-7 h-7 shrink-0" viewBox="0 0 24 24" fill="#25D366">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    <a href={generatedLink} target="_blank" rel="noopener noreferrer" className="text-[#00a884] font-bold text-sm hover:underline truncate flex-1">
                      {generatedLink.replace("https://", "")}
                    </a>
                  </div>

                  {/* QR Code */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <QRCodeSVG
                      id="wa-link-qr-svg"
                      value={generatedLink}
                      size={200}
                      level="H"
                      includeMargin={false}
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 w-full max-w-lg">
                    <button
                      onClick={copyLink}
                      className="flex-1 h-11 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-black rounded-xl transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy URL
                    </button>
                    <button
                      onClick={downloadQR}
                      className="flex-1 h-11 bg-white dark:bg-slate-800 border border-[#00a884] text-[#00a884] text-xs font-black rounded-xl transition-all active:scale-[0.98] hover:bg-[#00a884]/5 flex items-center justify-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download QR
                    </button>
                  </div>

                  <button onClick={reset} className="text-[11px] text-slate-400 hover:text-slate-600 font-medium transition-colors">
                    ← Generate another link
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
