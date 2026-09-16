'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Clock, MessageSquare, FileText, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { saveWindowReminderRule } from '@/app/actions/window-reminders';

interface RuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleToEdit?: any | null;
  templates: any[];
  onSaved: () => void;
}

const PRESET_MINUTES = [
  { label: '60 min (1 hour)', value: 60 },
  { label: '50 min warning', value: 50 },
  { label: '30 min warning', value: 30 },
  { label: '15 min urgent', value: 15 },
  { label: '10 min final warning', value: 10 }
];

export default function RuleModal({
  isOpen,
  onClose,
  ruleToEdit,
  templates,
  onSaved
}: RuleModalProps) {
  const [name, setName] = useState('');
  const [minutesBeforeExpiry, setMinutesBeforeExpiry] = useState<number>(50);
  const [messageType, setMessageType] = useState<'TEXT' | 'TEMPLATE'>('TEXT');
  const [textContent, setTextContent] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateLanguage, setTemplateLanguage] = useState('en');
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (ruleToEdit) {
      setName(ruleToEdit.name || '');
      setMinutesBeforeExpiry(ruleToEdit.minutesBeforeExpiry || 50);
      setMessageType(ruleToEdit.messageType || 'TEXT');
      setTextContent(ruleToEdit.textContent || '');
      setTemplateName(ruleToEdit.templateName || '');
      setTemplateLanguage(ruleToEdit.templateLanguage || 'en');
      setIsActive(ruleToEdit.isActive ?? true);
    } else {
      setName('50 Minute Expiry Warning');
      setMinutesBeforeExpiry(50);
      setMessageType('TEXT');
      setTextContent('Your WhatsApp 24-hour conversation window will expire in 50 minutes. Please reply to this message if you need further assistance from our team.');
      setTemplateName('');
      setTemplateLanguage('en');
      setIsActive(true);
    }
  }, [ruleToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }
    if (!minutesBeforeExpiry || minutesBeforeExpiry < 1 || minutesBeforeExpiry > 1440) {
      toast.error('Please provide a valid trigger time between 1 and 1440 minutes');
      return;
    }
    if (messageType === 'TEXT' && !textContent.trim()) {
      toast.error('Please provide message text to send');
      return;
    }
    if (messageType === 'TEMPLATE' && !templateName) {
      toast.error('Please select a Meta pre-approved WhatsApp template');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveWindowReminderRule({
        id: ruleToEdit?.id,
        name: name.trim(),
        minutesBeforeExpiry,
        messageType,
        textContent: messageType === 'TEXT' ? textContent : undefined,
        templateName: messageType === 'TEMPLATE' ? templateName : undefined,
        templateLanguage: messageType === 'TEMPLATE' ? templateLanguage : undefined,
        isActive
      });

      if (res.success) {
        toast.success(ruleToEdit ? 'Reminder rule updated' : 'New reminder rule created');
        onSaved();
        onClose();
      } else {
        toast.error(res.error || 'Failed to save reminder rule');
      }
    } catch (err: any) {
      toast.error(err?.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTemplate = templates?.find((t: any) => t.name === templateName);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl plus-jakarta-forced">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                {ruleToEdit ? 'Edit Window Reminder Rule' : 'Create 24h Expiry Reminder Rule'}
              </DialogTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure automated warnings sent before the WhatsApp 24-hour window expires.
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 pt-2">
          {/* Rule Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Rule Name *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 50 Minute Warning Alert"
              className="h-10 text-sm"
              required
            />
          </div>

          {/* Trigger Time Configuration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Trigger: Time Before 24h Expiry (Minutes) *
              </Label>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {minutesBeforeExpiry} {minutesBeforeExpiry === 1 ? 'minute' : 'minutes'} before window closes
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {PRESET_MINUTES.map((preset) => (
                <button
                  type="button"
                  key={preset.value}
                  onClick={() => setMinutesBeforeExpiry(preset.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    minutesBeforeExpiry === preset.value
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <Input
              type="number"
              min={1}
              max={1440}
              value={minutesBeforeExpiry}
              onChange={(e) => setMinutesBeforeExpiry(parseInt(e.target.value) || 1)}
              className="h-10 text-sm"
              required
            />
          </div>

          {/* Message Type Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Message Format *
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setMessageType('TEXT')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  messageType === 'TEXT'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shrink-0 shadow-sm">
                  <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-bold">Standard Text Message</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Freeform session message (Sent inside active 24h window)
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMessageType('TEMPLATE')}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  messageType === 'TEMPLATE'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 ring-1 ring-emerald-500'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="p-2 rounded-lg bg-white dark:bg-slate-800 shrink-0 shadow-sm">
                  <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <div className="text-xs font-bold">Meta Approved Template</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Use pre-approved template for marketing / re-engagement
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Content: Freeform Text vs Template */}
          {messageType === 'TEXT' ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Message Content *
              </Label>
              <Textarea
                rows={3}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Type the message to send to the customer..."
                className="text-sm resize-none"
                required
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                This message will be dispatched automatically when the customer service window reaches {minutesBeforeExpiry} minutes before expiry.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Select Meta Template *
                </Label>
                {templates && templates.length > 0 ? (
                  <Select value={templateName} onValueChange={setTemplateName}>
                    <SelectTrigger className="h-10 text-sm">
                      <SelectValue placeholder="Choose a WhatsApp template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((tpl: any) => (
                        <SelectItem key={tpl.id || tpl.name} value={tpl.name}>
                          {tpl.name} ({tpl.language || 'en'}) - {tpl.category || 'UTILITY'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>No WhatsApp templates found. You can sync templates in the Templates section or use Freeform Text message.</span>
                  </div>
                )}
              </div>

              {selectedTemplate && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-xs space-y-1">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">Template Preview:</div>
                  <p className="text-slate-600 dark:text-slate-400 italic">
                    {selectedTemplate.components?.find((c: any) => c.type === 'BODY')?.text || selectedTemplate.name}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Live Preview Card */}
          <div className="p-4 bg-slate-100/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/80">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              Customer WhatsApp Preview ({minutesBeforeExpiry}m Warning)
            </div>
            <div className="bg-[#E7FFDB] dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3.5 shadow-sm max-w-md">
              <p className="text-xs text-slate-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                {messageType === 'TEXT'
                  ? (textContent || 'Your reminder message preview will appear here...')
                  : (selectedTemplate?.components?.find((c: any) => c.type === 'BODY')?.text || templateName || 'Selected template preview...')}
              </p>
              <div className="flex justify-end items-center gap-1 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <CheckCircle2 className="w-3 h-3 text-blue-500" />
              </div>
            </div>
          </div>

          {/* Active Switch */}
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="space-y-0.5">
              <Label className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Rule Status
              </Label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                When enabled, the background worker will automatically dispatch this reminder when triggered.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl h-10 px-5 text-xs font-semibold w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-10 px-6 text-xs font-bold shadow-md w-full sm:w-auto"
            >
              {isSubmitting ? 'Saving...' : ruleToEdit ? 'Update Rule' : 'Create Reminder Rule'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
