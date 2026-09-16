'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ModalButton } from '@/components/ui/modal-button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createGroup } from '@/app/actions/groups';
import { toast } from 'sonner';
import { Users, FolderPlus } from 'lucide-react';

interface CreateGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    contactIds?: string[];
}

const PRESET_COLORS = [
    '#00B074', // WhatsApp Green
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#6366F1', // Indigo
];

export function CreateGroupModal({ isOpen, onClose, onSuccess, contactIds }: CreateGroupModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        color: '#00B074'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            await createGroup({
                ...formData,
                contactIds
            });
            toast.success('Group created successfully');
            onSuccess();
            onClose();
            setFormData({ name: '', description: '', color: '#00B074' });
        } catch (error: any) {
            toast.error(error.message || 'Failed to create group');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[440px] p-6 gap-0 bg-white dark:bg-slate-900 border-none shadow-[0_32px_64px_-15px_rgba(0,0,0,0.2)] overflow-hidden rounded-[2rem] plus-jakarta-forced">
                <DialogHeader className="pb-4">
                    <DialogTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        <FolderPlus className="w-5.5 h-5.5 text-[#00B074]" /> Create Segment
                    </DialogTitle>
                    {contactIds && contactIds.length > 0 ? (
                        <p className="text-[10px] font-bold text-[#00B074] bg-[#00B074]/10 px-2 py-0.5 rounded-full w-fit mt-1">
                            Adding {contactIds.length} selected contacts to new segment
                        </p>
                    ) : (
                        <p className="text-[11px] font-semibold text-slate-400 mt-1">
                            Group your contacts to launch multi-contact marketing campaigns.
                        </p>
                    )}
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <Label htmlFor="name" className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                            Segment Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                            id="name"
                            required
                            placeholder="e.g., VIP Customers, Campaign Leads..."
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="h-11 rounded-xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 focus-visible:ring-[#00B074] text-xs font-bold"
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                            Description
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Brief description of this segment..."
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            className="rounded-xl border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 focus-visible:ring-[#00B074] text-xs font-semibold resize-none"
                        />
                    </div>

                    {/* Badge Color */}
                    <div className="space-y-2">
                        <Label className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                            Label Color Badge
                        </Label>
                        <div className="flex gap-2.5 flex-wrap">
                            {PRESET_COLORS.map((color) => (
                                <button
                                    key={color}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, color })}
                                    className={`w-7 h-7 rounded-full transition-all relative flex items-center justify-center ${formData.color === color
                                        ? 'ring-2 ring-offset-2 ring-[#00B074]/50 scale-110 shadow-sm'
                                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                                    }`}
                                    style={{ backgroundColor: color }}
                                    aria-label={`Select color ${color}`}
                                >
                                    {formData.color === color && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <DialogFooter className="gap-2 pt-4 border-t border-slate-50 dark:border-slate-800/40">
                        <Button 
                            type="button" 
                            variant="ghost" 
                            onClick={onClose}
                            className="h-10 rounded-xl text-xs font-extrabold text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                            Cancel
                        </Button>
                        <Button 
                            type="submit" 
                            disabled={isLoading}
                            className="h-10 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-xs font-extrabold px-6 shadow-md shadow-emerald-500/10 active:scale-95 transition-all"
                        >
                            {isLoading ? 'Creating...' : 'Create Segment'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
