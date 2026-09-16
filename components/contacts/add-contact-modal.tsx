
'use client';

import { useEffect, useState } from'react';
import { Button } from'@/components/ui/button';
import {
 Dialog,
 DialogContent,
 DialogHeader,
 DialogTitle,
 DialogFooter,
} from'@/components/ui/dialog';
import { Input } from'@/components/ui/input';
import { Label } from'@/components/ui/label';
import { Textarea } from'@/components/ui/textarea';
import { getGroups } from'@/app/actions/groups';
import { toast } from'sonner';
import { Badge } from'@/components/ui/badge';
import { X } from'lucide-react';

interface AddContactModalProps {
 isOpen: boolean;
 onClose: () => void;
 onSuccess: () => void;
}

export function AddContactModal({ isOpen, onClose, onSuccess }: AddContactModalProps) {
 const [isLoading, setIsLoading] = useState(false);
 const [groups, setGroups] = useState<Array<{ id: string; name: string; color: string | null }>>([]);
 const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
 const [formData, setFormData] = useState({
 name:'',
 firstName:'',
 lastName:'',
 phoneNumber:'',
 email:'',
 notes:''
 });

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
 setIsLoading(true);

 try {
 await createContact({ ...formData, groupIds: selectedGroups });
 toast.success('Contact created successfully');
 onSuccess();
 onClose();
 setFormData({ name:'', firstName:'', lastName:'', phoneNumber:'', email:'', notes:'' });
 setSelectedGroups([]);
 } catch (error: any) {
 toast.error(error.message ||'Failed to create contact');
 } finally {
 setIsLoading(false);
 }
 };

 return (
 <Dialog open={isOpen} onOpenChange={onClose}>
 <DialogContent className="sm:max-w-[425px] rounded-2xl border border-gray-200 dark:border-slate-700 ">
 <DialogHeader>
 <DialogTitle className="font-semibold tracking-tight">Add New Contact</DialogTitle>
 </DialogHeader>
 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="grid grid-cols-2 gap-4">
 <div className="space-y-2">
 <Label htmlFor="firstName" className="font-semibold text-sm">First Name</Label>
 <Input
 id="firstName"
 value={formData.firstName}
 onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="lastName" className="font-semibold text-sm">Last Name</Label>
 <Input
 id="lastName"
 value={formData.lastName}
 onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
 />
 </div>
 </div>

 <div className="space-y-2">
 <Label htmlFor="name">Display Name *</Label>
 <Input
 id="name"
 required
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="phone" className="font-semibold text-sm">Phone Number (with Country Code) *</Label>
 <Input
 id="phone"
 required
 placeholder="e.g. 15551234567"
 value={formData.phoneNumber}
 onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="email" className="font-semibold text-sm">Email</Label>
 <Input
 id="email"
 type="email"
 value={formData.email}
 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
 />
 </div>

 <div className="space-y-2">
 <Label htmlFor="notes" className="font-semibold text-sm">Notes</Label>
 <Textarea
 id="notes"
 value={formData.notes}
 onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
 />
 </div>

 <div className="space-y-2">
 <Label className="font-semibold text-sm">Groups (Optional)</Label>
 <div className="space-y-2">
 <select
 className="w-full h-10 px-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-background text-sm"
 onChange={(e) => {
 const groupId = e.target.value;
 if (groupId && !selectedGroups.includes(groupId)) {
 setSelectedGroups([...selectedGroups, groupId]);
 }
 e.target.value ='';
 }}
 value=""
 >
 <option value="">Select a group...</option>
 {groups.filter(g => !selectedGroups.includes(g.id)).map((group) => (
 <option key={group.id} value={group.id}>{group.name}</option>
 ))}
 </select>
 {selectedGroups.length > 0 && (
 <div className="flex flex-wrap gap-1.5">
 {selectedGroups.map((groupId) => {
 const group = groups.find(g => g.id === groupId);
 if (!group) return null;
 return (
 <Badge
 key={groupId}
 variant="outline"
 className="text-[9px] font-semibold pl-2 pr-1 py-1"
 style={{
 borderColor: group.color ||'#00B074',
 backgroundColor:`${group.color ||'#00B074'}15`,
 color: group.color ||'#00B074'
 }}
 >
 {group.name}
 <button
 type="button"
 onClick={() => setSelectedGroups(selectedGroups.filter(id => id !== groupId))}
 className="ml-1 hover:bg-black/10 rounded-full p-0.5"
 >
 <X className="h-2.5 w-2.5" />
 </button>
 </Badge>
 );
 })}
 </div>
 )}
 </div>
 </div>

 <DialogFooter className="gap-2 sm:gap-0">
 <Button type="button" variant="outline" onClick={onClose} className="rounded-xl font-semibold text-sm">Cancel</Button>
 <Button type="submit" disabled={isLoading} className="rounded-xl bg-[#00B074] hover:bg-[#009662] font-semibold text-sm">{isLoading ?'Creating...' :'Create Contact'}</Button>
 </DialogFooter>
 </form>
 </DialogContent>
 </Dialog>
 );
}
