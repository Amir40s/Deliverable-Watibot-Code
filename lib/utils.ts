import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export async function downloadMedia(url: string, filename?: string) {
  if (!url) return;
  try {
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Fetch failed');
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    
    if (!filename) {
      const urlPath = url.split('?')[0];
      const urlFileName = urlPath.split('/').pop();
      if (urlFileName && urlFileName.includes('.')) {
        filename = urlFileName;
      } else {
        const ext = blob.type.startsWith('video/') ? '.mp4' : blob.type.startsWith('image/') ? '.jpg' : '';
        filename = `media_${Date.now()}${ext}`;
      }
    }
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch (err) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

export function isValidHexColor(color: string): boolean {
  if (!color) return false;
  return /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(color.trim());
}

export function normalizeHexColor(color?: string, fallback = "#10B981"): string {
  if (!color) return fallback;
  let hex = color.trim();
  if (!hex.startsWith("#")) {
    hex = `#${hex}`;
  }
  if (/^#[0-9A-Fa-f]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    return hex.toUpperCase();
  }
  return fallback;
}

export function format12HourTime(dateInput?: Date | string | number | null): string {
  if (!dateInput) return "";
  const date = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(date.getTime())) return "";

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";

  hours = hours % 12;
  hours = hours ? hours : 12;

  const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hours}:${minutesStr} ${ampm}`;
}
