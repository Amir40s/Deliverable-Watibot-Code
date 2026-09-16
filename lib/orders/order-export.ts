import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface OrderExportItem {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerPhone?: string | null;
  items?: any[];
  totalAmount?: number | null;
  currency?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  source?: string | null;
  agent?: { name?: string | null } | null;
  deliveryAddress?: string | null;
  notes?: string | null;
  createdAt?: any;
}

interface ExportOptions {
  filterName?: string;
}

function formatDate(date: any): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(date);
  }
}

function formatItems(items: any[] | undefined): string {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return items
    .map((item) => `${item.quantity || 1}x ${item.productName || item.title || item.name || "Item"}`)
    .join(", ");
}

/**
 * Export orders to Excel (.xlsx)
 */
export function exportOrdersToExcel(orders: OrderExportItem[], options: ExportOptions = {}) {
  if (!orders || orders.length === 0) {
    throw new Error("No orders to export");
  }

  const rows = orders.map((o, idx) => ({
    "#": idx + 1,
    "Order #": o.orderNumber || "—",
    "Customer Name": o.customerName || "—",
    "Customer Phone": o.customerPhone || "—",
    "Items": formatItems(o.items),
    "Total": `${o.currency || "PKR"} ${(o.totalAmount || 0).toLocaleString()}`,
    "Status": (o.status || "PENDING").toUpperCase(),
    "Agent / Source": o.agent?.name || (o.source === "AI_AGENT" ? "AI Chat" : "Manual"),
    "Delivery Address": o.deliveryAddress || "—",
    "Payment Status": (o.paymentStatus || "PENDING").toUpperCase(),
    "Notes": o.notes || "—",
    "Created Date": formatDate(o.createdAt),
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Compute adaptive column widths
  const colKeys = Object.keys(rows[0] || {});
  worksheet["!cols"] = colKeys.map((key) => {
    const maxContentLen = Math.max(
      key.length,
      ...rows.map((r) => String((r as any)[key] || "").length)
    );
    return { wch: Math.min(Math.max(maxContentLen + 3, 10), 50) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Orders");

  const dateStr = new Date().toISOString().split("T")[0];
  const filterPart = options.filterName ? `_${options.filterName.replace(/\s+/g, "_")}` : "";
  const filename = `Orders_Export${filterPart}_${dateStr}.xlsx`;

  XLSX.writeFile(workbook, filename);
}

/**
 * Export orders to styled PDF
 */
export function exportOrdersToPDF(orders: OrderExportItem[], options: ExportOptions = {}) {
  if (!orders || orders.length === 0) {
    throw new Error("No orders to export");
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
  doc.text("Orders Management Report", 30, 36);

  // Subtitle / Date Details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate 400
  const exportDate = new Date().toLocaleString();
  const filterLabel = options.filterName || "All Orders";
  doc.text(
    `Filter: ${filterLabel}  |  Total Orders: ${orders.length}  |  Generated: ${exportDate}`,
    pageWidth - 30,
    36,
    { align: "right" }
  );

  // Table Data
  const tableHeaders = [
    "#",
    "Order #",
    "Customer",
    "Phone",
    "Items",
    "Total",
    "Status",
    "Source",
    "Date",
  ];

  const tableBody = orders.map((o, i) => [
    i + 1,
    o.orderNumber || "—",
    o.customerName || "—",
    o.customerPhone || "—",
    formatItems(o.items),
    `${o.currency || "PKR"} ${(o.totalAmount || 0).toLocaleString()}`,
    (o.status || "PENDING").toUpperCase(),
    o.agent?.name || (o.source === "AI_AGENT" ? "AI Chat" : "Manual"),
    formatDate(o.createdAt),
  ]);

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
      1: { cellWidth: 100, fontStyle: "bold" },
      2: { cellWidth: 90 },
      3: { cellWidth: 85 },
      4: { cellWidth: 190 },
      5: { cellWidth: 70, halign: "right", fontStyle: "bold" },
      6: { cellWidth: 70, halign: "center" },
      7: { cellWidth: 70, halign: "center" },
      8: { cellWidth: 80, halign: "center" },
    },
    margin: { left: 30, right: 30 },
    didDrawPage: (data) => {
      // Footer page numbers
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
  const filename = `Orders_Report${filterPart}_${dateStr}.pdf`;

  doc.save(filename);
}
