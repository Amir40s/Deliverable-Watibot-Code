import { useState } from 'react';
import { X, Pipette, Check, Sparkles, Tag as TagIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, isValidHexColor, normalizeHexColor } from '@/lib/utils';

interface CreateTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (tagData: { name: string; color: string }) => void;
}

const PREDEFINED_COLORS = [
  "#10B981", // Emerald
  "#3B82F6", // Blue
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#64748B", // Slate
];

export function CreateTagModal({ isOpen, onClose, onSubmit }: CreateTagModalProps) {
  const [tagName, setTagName] = useState('');
  const [colorInput, setColorInput] = useState(PREDEFINED_COLORS[0]);

  if (!isOpen) return null;

  const isColorValid = isValidHexColor(colorInput);
  const normalizedHex = isColorValid ? normalizeHexColor(colorInput) : PREDEFINED_COLORS[0];

  const handleColorChange = (newColor: string) => {
    setColorInput(newColor);
  };

  const handleSubmit = () => {
    if (!tagName.trim() || !isColorValid) return;
    onSubmit?.({ name: tagName.trim(), color: normalizedHex });
    setTagName('');
    setColorInput(PREDEFINED_COLORS[0]);
    onClose();
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl mx-4 max-h-[90vh] overflow-y-auto p-6 sm:p-7 space-y-6 animate-in zoom-in-95 slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors"
              style={{ backgroundColor: `${normalizedHex}20`, color: normalizedHex }}
            >
              <TagIcon className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Create New Tag</h3>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* Tag Name & Custom Color in 2-column grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">Tag Name</label>
              <Input
                placeholder="e.g. VIP Customer"
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 h-11 rounded-xl text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus-visible:ring-[#00B074]/20 transition-all font-medium"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">Custom Color</label>
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
                    id="flow-custom-color-picker"
                  />
                  <label 
                    htmlFor="flow-custom-color-picker"
                    className="w-11 h-11 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 cursor-pointer shadow-sm transition-all group-hover:scale-105 group-active:scale-95"
                    style={{ backgroundColor: normalizedHex }}
                  >
                    <Pipette className="w-4 h-4 text-white mix-blend-difference drop-shadow" />
                  </label>
                </div>

                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono font-bold text-xs select-none">#</span>
                  <Input
                    value={colorInput.replace(/^#/, '')}
                    onChange={(e) => handleColorChange(`#${e.target.value.replace(/[^0-9A-Fa-f]/g, '').slice(0, 6)}`)}
                    placeholder="10B981"
                    maxLength={6}
                    className={cn(
                      "h-11 pl-7 font-mono font-bold text-xs uppercase bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white focus-visible:ring-[#00B074]/20",
                      !isColorValid && "border-rose-500 focus-visible:ring-rose-500/20"
                    )}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Palette */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 ml-1">Quick Colors</label>
            <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl h-11">
              {PREDEFINED_COLORS.map(color => {
                const isSelected = normalizedHex.toLowerCase() === color.toLowerCase();
                return (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorChange(color)}
                    className={cn(
                      "w-6 h-6 rounded-full transition-all transform hover:scale-110 flex items-center justify-center border-2",
                      isSelected ? "scale-110 border-white dark:border-slate-900 ring-2 shadow-md" : "border-transparent opacity-75 hover:opacity-100"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white stroke-[3.5]" />}
                  </button>
                );
              })}
            </div>
          </div>

          {!isColorValid && (
            <p className="text-xs text-rose-500 font-medium ml-1">
              Please enter a valid HEX color code (e.g. #10B981)
            </p>
          )}

          {/* Live Preview */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 ml-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00B074]" />
              Live Preview
            </label>
            <div className="p-3 bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800 rounded-2xl flex items-center justify-between">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                {tagName.trim() || 'Tag Name'}
              </span>
              <div 
                className="px-3 py-1 rounded-full border text-xs font-bold flex items-center gap-2"
                style={{
                  backgroundColor: `${normalizedHex}15`,
                  color: normalizedHex,
                  borderColor: `${normalizedHex}40`
                }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: normalizedHex }} />
                <span>{tagName.trim() || 'Preview'}</span>
              </div>
            </div>
          </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!tagName.trim() || !isColorValid}
          className="w-full bg-[#00B074] hover:bg-[#009662] text-white h-11 rounded-xl font-bold text-sm transition-all shadow-md shadow-[#00B074]/20 disabled:opacity-50"
        >
          Create Tag
        </Button>
      </div>
    </div>
  );
}
