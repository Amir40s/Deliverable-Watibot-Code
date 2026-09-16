import React from "react";

export function WhatsAppColorIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle with WhatsApp Green */}
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      {/* WhatsApp Speech Bubble & Phone Handset */}
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 4.2a7.8 7.8 0 0 0-6.73 11.75L4.5 19.5l3.66-.75A7.8 7.8 0 1 0 12 4.2zm4.56 11.08c-.19.53-1.1 1.02-1.52 1.09-.4.06-.9.08-1.46-.1-.34-.1-.78-.25-1.35-.5-2.38-1.03-3.93-3.46-4.05-3.62-.12-.16-.97-1.3-.97-2.47 0-1.18.62-1.75.84-1.99.22-.24.48-.3.64-.3.16 0 .32 0 .46.01.15.01.35-.06.55.42.2.48.68 1.66.74 1.78.06.12.1.26.02.42-.08.16-.12.26-.24.4-.12.14-.25.31-.36.42-.12.12-.25.25-.11.49.14.24.62 1.02 1.33 1.65.91.81 1.68 1.06 1.92 1.18.24.12.38.1.52-.06.14-.16.6-.7.76-.94.16-.24.32-.2.54-.12.22.08 1.4.66 1.64.78.24.12.4.18.46.28.06.1.06.58-.13 1.11z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function FacebookColorIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        d="M15.36 12.003h-2.36v6.997h-2.903v-6.997H8.35v-2.47h1.747V7.957c0-1.73 1.056-2.957 2.87-2.957.87 0 1.78.155 1.78.155v1.956h-1.002c-.99 0-1.298.614-1.298 1.244v1.178h2.203l-.29 2.47z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export function InstagramColorIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="insta-gradient" cx="20%" cy="110%" r="140%">
          <stop offset="0%" stopColor="#FEC053" />
          <stop offset="10%" stopColor="#FEC053" />
          <stop offset="50%" stopColor="#F2203E" />
          <stop offset="100%" stopColor="#611A9C" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#insta-gradient)" />
      <rect
        x="5.2"
        y="5.2"
        width="13.6"
        height="13.6"
        rx="3.8"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        fill="none"
      />
      <circle cx="12" cy="12" r="3.4" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
      <circle cx="15.8" cy="8.2" r="0.9" fill="#FFFFFF" />
    </svg>
  );
}
