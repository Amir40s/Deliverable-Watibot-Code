"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag as TagIcon, Check, Pipette, Sparkles } from "lucide-react";
import { createTag, updateTag } from "@/app/actions/tags";
import { toast } from "sonner";
import { cn, isValidHexColor, normalizeHexColor } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";

interface CreateTagModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  editData?: TagEditData;
}

interface TagEditData {
  id?: string;
  name?: string | null;
  color?: string | null;
  category?: string | null;
}

interface TagActionResult {
  error?: string;
  success?: boolean;
  data?: unknown;
}

const QUICK_COLORS = [
  { name: "Emerald", value: "#10B981" },
  { name: "Blue", value: "#3B82F6" },
  { name: "Amber", value: "#F59E0B" },
  { name: "Rose", value: "#F43F5E" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Cyan", value: "#06B6D4" },
  { name: "Slate", value: "#64748B" },
];

export function CreateTagModal({
  isOpen,
  onOpenChange,
  onSuccess,
  editData,
}: CreateTagModalProps) {
  const t = useTranslations("TagsPage.modal");
  const locale = useLocale();
  const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr";
  const isRtl = dir === "rtl";
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    color: "#10B981",
    category: "General",
  });
  const [colorInput, setColorInput] = useState("#10B981");

  useEffect(() => {
    if (editData && isOpen) {
      const initialColor = normalizeHexColor(editData.color || "#10B981");
      setFormData({
        name: editData.name || "",
        color: initialColor,
        category: editData.category || "General",
      });
      setColorInput(initialColor);
    } else if (!editData && isOpen) {
      setFormData({
        name: "",
        color: "#10B981",
        category: "General",
      });
      setColorInput("#10B981");
    }
  }, [editData, isOpen]);

  const isLabel = formData.category === "Label";

  const getCategoryLabel = (category?: string | null) => {
    const normalized = (category || "General").toLowerCase();
    if (normalized === "label") return t("categories.label");
    if (normalized === "tag") return t("categories.tag");
    return t("categories.general");
  };

  const handleColorChange = (newColor: string) => {
    setColorInput(newColor);
    if (isValidHexColor(newColor)) {
      setFormData((prev) => ({ ...prev, color: normalizeHexColor(newColor) }));
    }
  };

  const isColorValid = isValidHexColor(colorInput);
  const normalizedHex = isColorValid ? normalizeHexColor(colorInput) : "#10B981";

  const handleAction = async () => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) {
      toast.error(t("nameRequired") || "Tag name is required");
      return;
    }
    if (!isColorValid) {
      toast.error(t("invalidColor") || "Please select a valid HEX color");
      return;
    }

    setIsLoading(true);
    try {
      const res: TagActionResult = editData?.id
        ? await updateTag(
            editData.id,
            trimmedName,
            normalizedHex,
            formData.category
          )
        : await createTag(trimmedName, normalizedHex, formData.category);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(
          editData?.id
            ? isLabel
              ? t("labelUpdated")
              : t("tagUpdated")
            : isLabel
              ? t("labelCreated")
              : t("tagCreated")
        );
        onOpenChange(false);
        if (onSuccess) onSuccess();
      }
    } catch {
      toast.error(t("operationFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        dir={dir}
        className="sm:max-w-[620px] w-[95vw] max-h-[90vh] overflow-y-auto p-0 bg-white dark:bg-slate-900 border-none rounded-[32px] shadow-2xl"
        style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
      >
        <div className="p-6 sm:p-8 space-y-6">
          {/* Header */}
          <DialogHeader className="space-y-1">
            <div
              className={cn(
                "flex items-center justify-between mb-1",
                isRtl ? "flex-row-reverse" : ""
              )}
            >
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center transition-colors duration-300"
                style={{
                  backgroundColor: `${normalizedHex}18`,
                  color: normalizedHex,
                }}
              >
                <TagIcon className="w-5 h-5" />
              </div>
            </div>
            <DialogTitle
              className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight text-start"
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {isLabel
                ? editData?.id
                  ? t("editLabel")
                  : t("createLabel")
                : editData?.id
                  ? t("editTag")
                  : t("createTag")}
            </DialogTitle>
            <p
              className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm font-semibold text-start"
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {isLabel ? t("labelDescription") : t("tagDescription")}
            </p>
          </DialogHeader>

          {/* Form Content */}
          <div className="space-y-5">
            {/* Tag Name Input */}
            <div className="space-y-1.5">
              <Label
                className="text-xs font-bold text-slate-700 dark:text-slate-300 ms-1 text-start block"
                style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
              >
                {isLabel ? t("labelName") : t("tagName")}
              </Label>
              <Input
                dir={dir}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder={
                  isLabel ? t("labelPlaceholder") : t("tagPlaceholder")
                }
                className={cn(
                  "h-11 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl px-4 font-bold text-slate-900 dark:text-white focus-visible:ring-[#00B074]/20 focus-visible:border-[#00B074] focus-visible:ring-2 focus-visible:ring-offset-0 transition-all placeholder:text-slate-400/80 text-sm",
                  isRtl ? "text-right" : "text-left"
                )}
                style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
                autoFocus
              />
            </div>

            {/* Quick Colors (Left) & Custom Color Picker (Right) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Quick Preset Colors */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 ms-1 text-start block"
                    style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
                  >
                    {t("quickColors") || "Quick Colors"}
                  </Label>
                </div>
                <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl h-11">
                  {QUICK_COLORS.map((c) => {
                    const isSelected =
                      normalizedHex.toLowerCase() === c.value.toLowerCase();
                    return (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => handleColorChange(c.value)}
                        className={cn(
                          "w-6 h-6 rounded-full transition-all transform hover:scale-110 flex items-center justify-center border-2",
                          isSelected
                            ? "scale-110 shadow-md border-white dark:border-slate-900 ring-2"
                            : "opacity-75 hover:opacity-100 border-transparent"
                        )}
                        style={{
                          backgroundColor: c.value,
                          ...(isSelected ? { ringColor: c.value } : {}),
                        }}
                        title={c.name}
                      >
                        {isSelected && (
                          <Check className="w-3 h-3 text-white stroke-[3.5]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Input & Native Color Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label
                    className="text-xs font-bold text-slate-700 dark:text-slate-300 ms-1 text-start block"
                    style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
                  >
                    {t("customColor") || "Custom Color"}
                  </Label>
                  <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                    {normalizedHex}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative group shrink-0">
                    <input
                      type="color"
                      value={normalizedHex}
                      onChange={(e) => handleColorChange(e.target.value)}
                      className="absolute inset-0 opacity-0 w-11 h-11 cursor-pointer z-10"
                      id="custom-tag-color-picker-wide"
                    />
                    <label
                      htmlFor="custom-tag-color-picker-wide"
                      className="w-11 h-11 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm transition-all group-hover:scale-105 group-active:scale-95"
                      style={{ backgroundColor: normalizedHex }}
                    >
                      <Pipette className="w-4 h-4 text-white mix-blend-difference drop-shadow" />
                    </label>
                  </div>

                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs select-none">
                      #
                    </span>
                    <Input
                      value={colorInput.replace(/^#/, "")}
                      onChange={(e) => {
                        const val = `#${e.target.value.replace(/[^0-9A-Fa-f]/g, "").slice(0, 6)}`;
                        handleColorChange(val);
                      }}
                      placeholder="22C55E"
                      maxLength={6}
                      className={cn(
                        "h-11 pl-7 font-mono font-bold text-xs uppercase bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus-visible:ring-[#00B074]/20 focus-visible:border-[#00B074]",
                        !isColorValid && "border-rose-500 focus-visible:ring-rose-500/20"
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>

            {!isColorValid && (
              <p className="text-xs text-rose-500 font-medium ms-1">
                {t("invalidColor") || "Please enter a valid HEX color (e.g., #22C55E)"}
              </p>
            )}

            {/* Live Tag Preview Section */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ms-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#00B074]" />
                {t("preview") || "Tag Preview"}
              </Label>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors duration-300"
                    style={{
                      backgroundColor: `${normalizedHex}20`,
                      color: normalizedHex,
                    }}
                  >
                    <TagIcon className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 text-start">
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                      {formData.name.trim() ||
                        (isLabel ? t("labelPlaceholder") : t("tagPlaceholder"))}
                    </p>
                    <p className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400">
                      {getCategoryLabel(formData.category)}
                    </p>
                  </div>
                </div>

                {/* Badge Chip */}
                <div
                  className="px-3 py-1 rounded-full border text-xs font-bold transition-all flex items-center gap-2"
                  style={{
                    backgroundColor: `${normalizedHex}15`,
                    color: normalizedHex,
                    borderColor: `${normalizedHex}40`,
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: normalizedHex }}
                  />
                  <span>
                    {formData.name.trim() || "Preview"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            className={cn(
              "pt-2 flex items-center gap-3",
              isRtl ? "flex-row-reverse" : ""
            )}
          >
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              variant="ghost"
              className="flex-1 h-11 rounded-xl font-bold text-[13px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border-none"
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleAction}
              disabled={isLoading || !formData.name.trim() || !isColorValid}
              className="flex-1 h-11 bg-[#00B074] hover:bg-[#009662] text-white text-[13px] font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-95 border-none disabled:opacity-50"
              style={{ fontFamily: "Plus Jakarta Sans, sans-serif" }}
            >
              {isLoading
                ? t("saving")
                : isLabel
                  ? editData?.id
                    ? t("updateLabel")
                    : t("createLabel")
                  : editData?.id
                    ? t("updateTag")
                    : t("createTag")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
