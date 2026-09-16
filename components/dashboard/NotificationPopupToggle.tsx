"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getPopupNotificationsEnabled,
  setPopupNotificationsEnabled,
  subscribePopupNotificationsToggle,
} from "@/lib/notifications-toggle";
import { toast } from "sonner";

interface NotificationPopupToggleProps {
  variant?: "header" | "pill" | "settings" | "minimal";
  className?: string;
}

export function NotificationPopupToggle({
  variant = "pill",
  className,
}: NotificationPopupToggleProps) {
  const [isEnabled, setIsEnabled] = useState<boolean>(true);

  useEffect(() => {
    setIsEnabled(getPopupNotificationsEnabled());
    const unsubscribe = subscribePopupNotificationsToggle((enabled) => {
      setIsEnabled(enabled);
    });
    return unsubscribe;
  }, []);

  const handleToggle = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextState = !isEnabled;
    setIsEnabled(nextState);
    setPopupNotificationsEnabled(nextState);

    if (nextState) {
      toast.success("Popup notifications enabled", {
        description: "You will receive visual popup cards for new incoming messages.",
      });
    } else {
      toast.info("Popup notifications disabled", {
        description: "New messages will arrive silently without popup cards.",
      });
    }
  };

  if (variant === "minimal") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        title={isEnabled ? "Disable message popup notifications" : "Enable message popup notifications"}
        className={cn(
          "p-1.5 rounded-full transition-all active:scale-95 flex items-center justify-center select-none",
          isEnabled
            ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
            : "text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700",
          className
        )}
      >
        {isEnabled ? (
          <Bell className="w-4 h-4 text-emerald-500" />
        ) : (
          <BellOff className="w-4 h-4 text-slate-400" />
        )}
      </button>
    );
  }

  if (variant === "header") {
    return (
      <div
        onClick={handleToggle}
        className={cn(
          "flex items-center justify-between px-3 py-2 rounded-xl transition-all cursor-pointer select-none text-xs font-semibold",
          isEnabled
            ? "bg-emerald-50/80 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100/80"
            : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200/80",
          className
        )}
      >
        <div className="flex items-center gap-2">
          {isEnabled ? (
            <Bell className="w-4 h-4 text-emerald-500" />
          ) : (
            <BellOff className="w-4 h-4 text-slate-400" />
          )}
          <span>Message Popups</span>
        </div>
        <span
          className={cn(
            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
            isEnabled
              ? "bg-emerald-500 text-white"
              : "bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          )}
        >
          {isEnabled ? "ON" : "OFF"}
        </span>
      </div>
    );
  }

  if (variant === "settings") {
    return (
      <div
        className={cn(
          "flex items-center justify-between p-4 rounded-2xl border transition-all",
          isEnabled
            ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/10"
            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111b21]",
          className
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "p-2.5 rounded-xl mt-0.5",
              isEnabled
                ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
            )}
          >
            {isEnabled ? (
              <Bell className="w-5 h-5" />
            ) : (
              <BellOff className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Incoming Message Popups
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-md">
              Display popup notification cards on screen when new WhatsApp & chat messages arrive. Turning this OFF prevents high-volume lag while still receiving all messages in the inbox.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleToggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
            isEnabled ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
              isEnabled ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>
    );
  }

  // Default "pill" variant
  return (
    <button
      type="button"
      onClick={handleToggle}
      title={isEnabled ? "Click to turn OFF message popup cards" : "Click to turn ON message popup cards"}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold transition-all active:scale-95 select-none cursor-pointer shadow-sm",
        isEnabled
          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
          : "bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-200",
        className
      )}
    >
      {isEnabled ? (
        <>
          <Bell className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
          <span>Popups ON</span>
        </>
      ) : (
        <>
          <BellOff className="w-3.5 h-3.5 text-slate-400" />
          <span>Popups OFF</span>
        </>
      )}
    </button>
  );
}
