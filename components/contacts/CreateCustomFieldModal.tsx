"use client";

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    Dialog,
    DialogContent,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Tag, Pencil, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface CreateCustomFieldModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateCustomFieldModal({ isOpen, onClose, onSuccess }: CreateCustomFieldModalProps) {
    const t = useTranslations('Contacts');
    const [isLoading, setIsLoading] = useState(false);
    const [fieldName, setFieldName] = useState('');
    const [existingFields, setExistingFields] = useState<string[]>([]);
    
    // Inline Edit States
    const [editingField, setEditingField] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState('');

    useEffect(() => {
        if (isOpen) {
            getCustomAttributes()
                .then(fields => setExistingFields(fields))
                .catch(console.error);
        } else {
            setExistingFields([]);
            setFieldName('');
            setEditingField(null);
            setEditingValue('');
        }
    }, [isOpen]);

    const handleSubmit = async () => {
        if (!fieldName.trim()) {
            toast.error('Field name is required');
            return;
        }
        setIsLoading(true);
        try {
            await createCustomAttribute(fieldName);
            toast.success('Custom field created successfully');
            setFieldName('');
            const fields = await getCustomAttributes();
            setExistingFields(fields);
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || 'Failed to create custom field');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const startEdit = (field: string) => {
        setEditingField(field);
        setEditingValue(field);
    };

    const cancelEdit = () => {
        setEditingField(null);
        setEditingValue('');
    };

    const handleRename = async (oldName: string) => {
        if (!editingValue.trim()) {
            toast.error('Field name is required');
            return;
        }
        setIsLoading(true);
        try {
            await renameCustomAttribute(oldName, editingValue);
            toast.success('Custom field renamed successfully');
            const fields = await getCustomAttributes();
            setExistingFields(fields);
            setEditingField(null);
            setEditingValue('');
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || 'Failed to rename custom field');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (field: string) => {
        if (!confirm(`Are you sure you want to delete "${field}"? This will permanently remove this field and its values from all contacts.`)) {
            return;
        }
        setIsLoading(true);
        try {
            await deleteCustomAttribute(field);
            toast.success('Custom field deleted successfully');
            const fields = await getCustomAttributes();
            setExistingFields(fields);
            onSuccess();
        } catch (error: any) {
            toast.error(error.message || 'Failed to delete custom field');
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) onClose();
        }}>
            <DialogContent className="max-w-xl p-0 gap-0 bg-white dark:bg-slate-900 border-none rounded-[2rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.2)] overflow-hidden plus-jakarta-forced">
                 <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div>
                        <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            Manage Custom Fields
                        </DialogTitle>
                        <p className="text-[13px] text-slate-400 font-medium mt-0.5">Create, edit, and delete custom fields to store contact information.</p>
                    </div>
                </div>

                 <div className="px-8 py-8 space-y-6">
                     <div className="space-y-2">
                        <Label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] px-1 flex justify-between">
                            <span className="flex items-center gap-2"><Plus className="w-3 h-3 text-[#00B074]" /> New Field Name</span>
                            <span className="text-rose-500">*</span>
                        </Label>
                        <div className="flex gap-2">
                            <Input
                                placeholder="e.g. Customer ID, Anniversary..."
                                value={fieldName}
                                onChange={(e) => setFieldName(e.target.value)}
                                className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 h-12 rounded-xl text-sm px-4 focus-visible:ring-primary/10 transition-all font-medium placeholder:text-slate-400/80 flex-1"
                                maxLength={50}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSubmit();
                                }}
                            />
                            <Button
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="h-12 px-6 rounded-xl font-bold bg-[#00B074] hover:bg-[#009c66] text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20"
                            >
                                {isLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                                ) : (
                                    <span>Create Field</span>
                                )}
                            </Button>
                        </div>
                    </div>

                     <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <Label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] px-1 flex items-center gap-2">
                            <Tag className="w-3 h-3 text-indigo-500" /> Existing Custom Fields
                        </Label>
                        {existingFields.length > 0 ? (
                            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                                {existingFields.map(field => {
                                    const isEditing = editingField === field;
                                    return (
                                        <div 
                                            key={field}
                                            className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/60 shadow-sm transition-all hover:bg-slate-100/50 dark:hover:bg-slate-800/80 group"
                                        >
                                            {isEditing ? (
                                                <div className="flex items-center gap-2 w-full">
                                                    <Input
                                                        value={editingValue}
                                                        onChange={(e) => setEditingValue(e.target.value)}
                                                        className="h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg flex-1 font-semibold"
                                                        maxLength={50}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') handleRename(field);
                                                            if (e.key === 'Escape') cancelEdit();
                                                        }}
                                                        autoFocus
                                                    />
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={() => handleRename(field)}
                                                        disabled={isLoading}
                                                        className="h-9 w-9 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg shrink-0"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        onClick={cancelEdit}
                                                        disabled={isLoading}
                                                        className="h-9 w-9 text-slate-450 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg shrink-0"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <>
                                                    <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-200">
                                                        {field}
                                                    </span>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => startEdit(field)}
                                                            className="h-8 w-8 text-slate-450 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 rounded-lg cursor-pointer"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleDelete(field)}
                                                            className="h-8 w-8 text-slate-450 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg cursor-pointer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-xs italic text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                                No custom fields created yet.
                            </div>
                        )}
                    </div>
                </div>

                 <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="h-12 px-6 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        Close
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

