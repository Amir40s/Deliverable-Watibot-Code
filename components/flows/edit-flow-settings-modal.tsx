'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { updateFlow } from '@/app/actions/flows';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Flow } from '@/types/flow';

interface EditFlowSettingsModalProps {
    flow: Flow | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (updatedFlow: Flow) => void;
}

export function EditFlowSettingsModal({ flow, isOpen, onClose, onSuccess }: EditFlowSettingsModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        platform: 'ALL',
    });

    useEffect(() => {
        if (flow) {
            setFormData({
                name: flow.name || '',
                description: flow.description || '',
                platform: flow.platform || 'ALL',
            });
        }
    }, [flow]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!flow) return;
        if (!formData.name.trim()) {
            toast.error('Please enter a flow name');
            return;
        }

        setIsLoading(true);
        try {
            const result = await updateFlow(flow.id, {
                name: formData.name,
                description: formData.description,
                platform: formData.platform,
            });

            if (result.success) {
                toast.success('Flow settings updated successfully');
                onSuccess({
                    ...flow,
                    name: formData.name,
                    description: formData.description,
                    platform: formData.platform,
                });
                onClose();
            } else {
                toast.error('Failed to update flow settings');
            }
        } catch (error) {
            console.error('Flow update error:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to update flow');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Edit Flow Settings</DialogTitle>
                    <DialogDescription>
                        Update your automation flow&apos;s name, description, and target platform.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-6 py-6">

                        {/* Flow Name */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="edit-name"
                                className="text-sm font-medium text-gray-700"
                            >
                                Flow Name <span className="text-red-500">*</span>
                            </Label>

                            <Input
                                id="edit-name"
                                placeholder="Enter a clear and descriptive flow name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                className="h-11 border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all duration-200"
                                autoFocus
                            />

                            <p className="text-xs text-gray-500">
                                This name will help you identify the flow internally.
                            </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="edit-description"
                                className="text-sm font-medium text-gray-700"
                            >
                                Description
                                <span className="text-gray-400 text-xs ml-1">(Optional)</span>
                            </Label>

                            <Textarea
                                id="edit-description"
                                placeholder="Provide a brief explanation of what this flow is intended to handle."
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                className="min-h-[100px] border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all duration-200 resize-none"
                            />

                            <p className="text-xs text-gray-500">
                                Adding a description makes it easier for your team to understand the purpose of this flow.
                            </p>
                        </div>

                        {/* Platform Selection */}
                        <div className="space-y-2">
                            <Label
                                htmlFor="edit-platform"
                                className="text-sm font-medium text-gray-700"
                            >
                                Target Platform <span className="text-red-500">*</span>
                            </Label>

                            <Select
                                value={formData.platform}
                                onValueChange={(value) => setFormData({ ...formData, platform: value })}
                            >
                                <SelectTrigger className="h-11 border-gray-300 focus:border-green-600 focus:ring-2 focus:ring-green-100 transition-all duration-200">
                                    <SelectValue placeholder="Select platform" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">All Platforms</SelectItem>
                                    <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                                    <SelectItem value="FACEBOOK">Facebook Inbox</SelectItem>
                                    <SelectItem value="FACEBOOK_COMMENT">Facebook Comment Automation</SelectItem>
                                    <SelectItem value="INSTAGRAM">Instagram Inbox</SelectItem>
                                    <SelectItem value="INSTAGRAM_COMMENT">Instagram Comment Automation</SelectItem>
                                    <SelectItem value="INSTAGRAM_STORY_REPLY">Instagram Story Reply</SelectItem>
                                </SelectContent>
                            </Select>

                            <p className="text-xs text-gray-500">
                                Choose if this flow should work for all platforms or only a specific one.
                            </p>
                        </div>

                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onClose}
                            disabled={isLoading}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading} className="bg-primary hover:opacity-90 text-primary-foreground font-bold">
                            {isLoading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
