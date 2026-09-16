import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface AppointmentExportItem {
  id: string;
  appointmentNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  serviceName?: string | null;
  durationMinutes?: number | null;
  price?: number | null;
  date?: string | null;
  time?: string | null;
  status?: string | null;
  notes?: string | null;
  location?: string | null;
  source?: string | null;
  contact?: {
    aiAgent?: { name?: string | null } | null;
    assignedAgent?: { name?: string | null } | null;
  } | null;
  createdAt?: any;
}

interface ExportOptions {
  filterName?: string;
}

function formatDate(date: any): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(date);
  }
}

/**
 * Export appointments to Excel (.xlsx)
 */
export function exportAppointmentsToExcel(
  appointments: AppointmentExportItem[],
  options: ExportOptions = {}
) {
  if (!appointments || appointments.length === 0) {
    throw new Error("No appointments to export");
  }

  const rows = appointments.map((apt, idx) => {
    const agentSource =
      apt.contact?.aiAgent?.name
        ? `AI: ${apt.contact.aiAgent.name}`
        : apt.contact?.assignedAgent?.name
        ? `Agent: ${apt.contact.assignedAgent.name}`
        : apt.source === "AI_AGENT"
        ? "AI Chat"
        : "Manual";

    return {
      "#": idx + 1,
      "Booking #": apt.appointmentNumber || "—",
      "Customer Name": apt.customerName || "—",
      "Customer Phone": apt.customerPhone || "—",
      "Service": apt.serviceName || "—",
      "Duration (Mins)": apt.durationMinutes || "—",
      "Price": apt.price !== null && apt.price !== undefined ? `PKR ${apt.price.toLocaleString()}` : "—",
      "Appointment Date": apt.date || "—",
      "Appointment Time": apt.time || "—",
      "Status": (apt.status || "PENDING").toUpperCase(),
      "Agent / Source": agentSource,
      "Notes": apt.notes || "—",
      "Created Date": formatDate(apt.createdAt),
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Compute adaptive column widths
  const colKeys = Object.keys(rows[0] || {});
  worksheet["!cols"] = colKeys.map((key) => {
    const maxContentLen = Math.max(
      key.length,
      ...rows.map((r) => String((r as any)[key] || "").length)
    );
    return { wch: Math.min(Math.max(maxContentLen + 3, 10), 45) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Appointments");

  const dateStr = new Date().toISOString().split("T")[0];
  const filterPart = options.filterName ? `_${options.filterName.replace(/\s+/g, "_")}` : "";
  const filename = `Appointments_Export${filterPart}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export appointments to styled PDF
 */
export function exportAppointmentsToPDF(
  appointments: AppointmentExportItem[],
  options: ExportOptions = {}
) {
  if (!appointments || appointments.length === 0) {
    throw new Error("No appointments to export");
  }

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.rect(0, 0, pageWidth, 60, "F");

  // Brand Accent Line
  doc.setFillColor(0, 168, 132); // Emerald #00a884
  doc.rect(0, 57, pageWidth, 3, "F");

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Appointments & Bookings Report", 30, 36);

  // Subtitle / Date Details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  const exportDate = new Date().toLocaleString();
  const filterLabel = options.filterName || "All Bookings";
  doc.text(
    `Filter: ${filterLabel}  |  Total Bookings: ${appointments.length}  |  Generated: ${exportDate}`,
    pageWidth - 30,
    36,
    { align: "right" }
  );

  // Table Data
  const tableHeaders = [
    "#",
    "Booking #",
    "Customer",
    "Phone",
    "Service",
    "Duration",
    "Date & Time",
    "Source",
    "Status",
  ];

  const tableBody = appointments.map((apt, i) => {
    const agentSource =
      apt.contact?.aiAgent?.name
        ? `AI: ${apt.contact.aiAgent.name}`
        : apt.contact?.assignedAgent?.name
        ? `Agent: ${apt.contact.assignedAgent.name}`
        : apt.source === "AI_AGENT"
        ? "AI Chat"
        : "Manual";

    return [
      i + 1,
      apt.appointmentNumber || "—",
      apt.customerName || "—",
      apt.customerPhone || "—",
      apt.serviceName || "—",
      apt.durationMinutes ? `${apt.durationMinutes}m` : "—",
      `${apt.date || "—"} ${apt.time || ""}`.trim(),
      agentSource,
      (apt.status || "PENDING").toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY: 75,
    head: [tableHeaders],
    body: tableBody,
    theme: "grid",
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
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
      1: { cellWidth: 105, fontStyle: "bold" },
      2: { cellWidth: 100 },
      3: { cellWidth: 90 },
      4: { cellWidth: 120 },
      5: { cellWidth: 55, halign: "center" },
      6: { cellWidth: 110 },
      7: { cellWidth: 90 },
      8: { cellWidth: 80, halign: "center", fontStyle: "bold" },
    },
    margin: { left: 30, right: 30 },
    didDrawPage: (data) => {
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
        pageWidth - 30,
        pageHeight - 15,
        { align: "right" }
      );
    },
  });

  const dateStr = new Date().toISOString().split("T")[0];
  const filterPart = options.filterName ? `_${options.filterName.replace(/\s+/g, "_")}` : "";
  const filename = `Appointments_Report${filterPart}_${dateStr}.pdf`;

  doc.save(filename);
}
