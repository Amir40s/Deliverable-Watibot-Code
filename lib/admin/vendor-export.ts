import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import type { VendorRow } from "@/app/[locale]/admin/vendors/actions"

interface ExportOptions {
  filterName?: string
  searchQuery?: string
  totalCount?: number
}

function formatDate(date: any): string {
  if (!date) return "—"
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return String(date)
  }
}

/**
 * Export filtered/selected vendors to Excel (.xlsx)
 */
export function exportVendorsToExcel(
  vendors: VendorRow[],
  options: ExportOptions = {}
) {
  if (!vendors || vendors.length === 0) {
    throw new Error("No vendor data to export")
  }

  const rows = vendors.map((v, idx) => ({
    "#": idx + 1,
    "Vendor Name": v.title || "—",
    "Slug / Username": v.username || "—",
    "Contact Person": v.adminName || "—",
    "Email": v.email || "—",
    "Phone Number": v.phoneNumber || "—",
    "WhatsApp Number": v.whatsappNumber || "—",
    "WABA Status": (v.whatsappStatus || "DISCONNECTED").toUpperCase(),
    "Subscription Plan": (v.plan || "Free").toUpperCase(),
    "Plan Start Date": formatDate(v.planStartDate),
    "Plan Expiry Date": formatDate(v.planEndDate),
    "Contacts Count": v.contactsCount ?? 0,
    "AI Bot Replies": v.isAiBotEnabled ? "ENABLED" : "DISABLED",
    "Account Status": (v.status || "ACTIVE").toUpperCase(),
    "Subscription Status": (v.subscriptionStatus || "active").toUpperCase(),
    "Registered Date": formatDate(v.createdAt),
  }))

  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Compute adaptive column widths
  const colKeys = Object.keys(rows[0] || {})
  worksheet["!cols"] = colKeys.map((key) => {
    const maxContentLen = Math.max(
      key.length,
      ...rows.map((r) => String((r as any)[key] || "").length)
    )
    return { wch: Math.min(Math.max(maxContentLen + 3, 10), 40) }
  })

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Vendors")

  const dateStr = new Date().toISOString().split("T")[0]
  const filterPart = options.filterName
    ? `_${options.filterName.replace(/\s+/g, "_")}`
    : ""
  const filename = `Vendors_Export${filterPart}_${dateStr}.xlsx`

  XLSX.writeFile(workbook, filename)
}

/**
 * Export filtered/selected vendors to a styled, professional PDF
 */
export function exportVendorsToPDF(
  vendors: VendorRow[],
  options: ExportOptions = {}
) {
  if (!vendors || vendors.length === 0) {
    throw new Error("No vendor data to export")
  }

  // Landscape orientation for comprehensive columns
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()

  // Header Banner
  doc.setFillColor(15, 23, 42) // Slate 900
  doc.rect(0, 0, pageWidth, 60, "F")

  // Brand Accent Bar
  doc.setFillColor(0, 168, 132) // Emerald #00a884
  doc.rect(0, 57, pageWidth, 3, "F")

  // Title
  doc.setFont("helvetica", "bold")
  doc.setFontSize(18)
  doc.setTextColor(255, 255, 255)
  doc.text("WatiBot — Vendors & Accounts Report", 30, 36)

  // Subtitle / Filter Details
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(148, 163, 184) // Slate 400
  const exportDate = new Date().toLocaleString()
  const filterLabel = options.filterName || "All"
  doc.text(
    `Filter: ${filterLabel}  |  Total Records: ${vendors.length}  |  Generated: ${exportDate}`,
    pageWidth - 30,
    36,
    { align: "right" }
  )

  // Format Table Data
  const tableHeaders = [
    "#",
    "Vendor Name",
    "Contact Person",
    "Email & Phone",
    "WABA Status",
    "Plan",
    "Expiry Date",
    "Account Status",
  ]

  const tableBody = vendors.map((v, i) => [
    i + 1,
    v.title || "—",
    v.adminName || "—",
    `${v.email || "—"}\n${v.whatsappNumber || v.phoneNumber || "—"}`,
    (v.whatsappStatus || "DISCONNECTED").toUpperCase(),
    (v.plan || "Free").toUpperCase(),
    formatDate(v.planEndDate),
    (v.status || "ACTIVE").toUpperCase(),
  ])

  autoTable(doc, {
    startY: 75,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249], // Slate 100
      textColor: [15, 23, 42], // Slate 900
      fontStyle: "bold",
      fontSize: 9,
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [51, 65, 85],
      lineColor: [241, 245, 249],
      lineWidth: 0.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 25, halign: "center" },
      1: { cellWidth: 140, fontStyle: "bold" },
      2: { cellWidth: 100 },
      3: { cellWidth: 170 },
      4: { cellWidth: 85, halign: "center" },
      5: { cellWidth: 70, halign: "center" },
      6: { cellWidth: 80, halign: "center" },
      7: { cellWidth: 80, halign: "center" },
    },
    didDrawCell: (data) => {
      // Colorize WABA Status cell
      if (data.section === "body" && data.column.index === 4) {
        const text = String(data.cell.raw || "")
        if (text === "LIVE" || text === "CONNECTED" || text === "APPROVED") {
          doc.setTextColor(5, 150, 105) // Emerald 600
        } else if (text === "BANNED" || text === "DISABLED" || text === "BLOCKED") {
          doc.setTextColor(225, 29, 72) // Rose 600
        } else {
          doc.setTextColor(100, 116, 139) // Slate 500
        }
      }
    },
    didDrawPage: (data) => {
      // Footer page numbers
      const str = `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(148, 163, 184)
      doc.text(str, pageWidth - 30, pageHeight - 15, { align: "right" })
      doc.text(
        "CONFIDENTIAL — WatiBot Platform Admin Console",
        30,
        pageHeight - 15
      )
    },
    margin: { top: 75, right: 30, bottom: 30, left: 30 },
  })

  const dateStr = new Date().toISOString().split("T")[0]
  const filterPart = options.filterName
    ? `_${options.filterName.replace(/\s+/g, "_")}`
    : ""
  const filename = `Vendors_Report${filterPart}_${dateStr}.pdf`

  doc.save(filename)
}
