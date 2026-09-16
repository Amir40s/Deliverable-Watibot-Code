'use client';

import { useState, useEffect } from'react';
import { Button } from'@/components/ui/button';
import { ModalButton } from'@/components/ui/modal-button';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from'@/components/ui/dialog';
import {
 Select,
 SelectContent,
 SelectItem,
 SelectTrigger,
 SelectValue,
} from'@/components/ui/select';
import { Label } from'@/components/ui/label';
import { addContactsToGroup, getGroups } from'@/app/actions/groups';
import { toast } from'sonner';

interface AddToGroupModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSuccess: () => void;
 contactIds: string[];
}

export function AddToGroupModal({ isOpen, onClose, onSuccess, contactIds }: AddToGroupModalProps) {
 const [isLoading, setIsLoading] = useState(false);
 const [selectedGroupId, setSelectedGroupId] = useState<string>('');
 const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);

 useEffect(() => {
 if (isOpen) {
 loadGroups();
 }
 }, [isOpen]);

 const loadGroups = async () => {
 try {
 const { groups: fetchedGroups } = await getGroups();
 setGroups(fetchedGroups as any);
 } catch (error) {
 console.error('Failed to load groups:', error);
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!selectedGroupId) {
 toast.error('Please select a group');
 return;
 }

 setIsLoading(true);
 try {
 await addContactsToGroup(selectedGroupId, contactIds);
 toast.success(`Added ${contactIds.length} contacts to group`);
 onSuccess();
 onClose();
 setSelectedGroupId('');
 } catch (error: any) {
 toast.error(error.message ||'Failed to add contacts to group');
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="sm:max-w-[425px] rounded-2xl border border-gray-200 dark:border-slate-700 ">
 <DialogHeader>
 <DialogTitle className="font-semibold tracking-tight">Add to Group</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="space-y-2">
 <Label htmlFor="group" className="font-semibold text-sm">Select Group</Label>
 <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
 <SelectTrigger className="w-full">
 <SelectValue placeholder="Select a group" />
 </SelectTrigger>
 <SelectContent>
 {groups.map((group) => (
 <SelectItem key={group.id} value={group.id}>
 {group.name}
 </SelectItem>
 ))}
 </SelectContent>
 </Select>
 <p className="text-[10px] text-muted-foreground">
 Adding {contactIds.length} selected contacts to this group.
 </p>
 </div>

 <DialogFooter className="gap-2 sm:gap-2">
 <ModalButton variant="outline" onClick={onClose}>Cancel</ModalButton>
 <ModalButton type="submit" loading={isLoading} disabled={!selectedGroupId} className="bg-[#00B074] hover:bg-[#009662]">
 Add to Group
 </ModalButton>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}
