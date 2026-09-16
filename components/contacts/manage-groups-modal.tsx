'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import { 
    getGroups, 
    deleteGroup, 
    updateGroup, 
    getGroupContacts, 
    addContactsToGroup, 
    addNumberToGroup, 
    removeContactFromGroup,
    bulkImportContactsToGroup
} from '@/app/actions/groups';
import { toast } from 'sonner';
import { Pencil, Trash2, Users, Eye, Plus, X, ArrowLeft, Search, Loader2, Sparkles, UserPlus, Phone, Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';
import { CreateGroupModal } from './create-group-modal';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface ManageGroupsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface Group {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    _count: {
        contacts: number;
    };
}

const TARGET_ATTRIBUTES = [
  { key: "name", label: "Name", required: false },
  { key: "phoneNumber", label: "Mobile Number", required: true },
  { key: "source", label: "Source", required: false },
  { key: "tags", label: "Tags / Labels", required: false },
];

export function ManageGroupsModal({ isOpen, onClose }: ManageGroupsModalProps) {
    const router = useRouter();
    
    // Main View States
    const [groups, setGroups] = useState<Group[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // Group Contacts Manager States
    const [activeGroup, setActiveGroup] = useState<Group | null>(null);
    const [activeGroupContacts, setActiveGroupContacts] = useState<any[]>([]);
    const [isContactsLoading, setIsContactsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [directNumber, setDirectNumber] = useState('');
    const [isAddingNumber, setIsAddingNumber] = useState(false);
    const [isSearchingContacts, setIsSearchingContacts] = useState(false);

    // CSV Import States
    const [isImportingCsv, setIsImportingCsv] = useState(false);
    const [rawRows, setRawRows] = useState<any[]>([]);
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [mappings, setMappings] = useState<Record<string, string>>({});
    const [fileName, setFileName] = useState('');
    const [isImportLoading, setIsImportLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();

        reader.onload = async (event) => {
            try {
                const XLSX = await import('xlsx');
                const dataBuffer = event.target?.result;
                const wb = XLSX.read(dataBuffer, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                if (data.length === 0) {
                    toast.error("The uploaded file does not contain any data rows.");
                    return;
                }

                // Extract unique column headers
                const headers = Array.from(
                    new Set(data.flatMap((row) => Object.keys(row as object)))
                );

                  const initialMappings: Record<string, string> = {
                    name: "",
                    phoneNumber: "",
                    source: "",
                    tags: "",
                };

                setRawHeaders(headers);
                setRawRows(data);
                setMappings(initialMappings);
            } catch (error) {
                console.error("Error parsing file:", error);
                toast.error("Failed to parse file. Please ensure it is a valid Excel or CSV sheet.");
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const handleCsvImport = async () => {
        if (!activeGroup) return;
        const selectedPhoneHeader = mappings["phoneNumber"];
        if (!selectedPhoneHeader || selectedPhoneHeader === "none" || selectedPhoneHeader === "") {
            toast.error("Please map a CSV column to 'Mobile Number'.");
            return;
        }

        setIsImportLoading(true);
        try {
            const contactsToCreate = rawRows
                .map((row) => {
                    const selectedNameHeader = mappings["name"];
                    const name = (selectedNameHeader && selectedNameHeader !== "none" && selectedNameHeader !== "") ? String(row[selectedNameHeader] || "") : "";
                    
                    let rawPhone = row[selectedPhoneHeader] !== undefined && row[selectedPhoneHeader] !== null ? String(row[selectedPhoneHeader]) : "";
                    let formattedPhone = rawPhone.trim();

                    const sourceHeader = mappings["source"];
                    const tagsHeader = mappings["tags"];

                    const source = (sourceHeader && sourceHeader !== "none" && sourceHeader !== "") ? String(row[sourceHeader] || "") : "";
                    const tags = (tagsHeader && tagsHeader !== "none" && tagsHeader !== "") ? String(row[tagsHeader] || "") : "";

                    return {
                        name: name || formattedPhone || "Imported Contact",
                        phoneNumber: formattedPhone,
                        notes: `Source: ${source}, Tags: ${tags}`,
                    };
                })
                .filter((c) => c.phoneNumber.replace(/\D/g, '').length >= 7);

            if (contactsToCreate.length === 0) {
                toast.error("No contacts found. The mapped Mobile Number column is empty.");
                setIsImportLoading(false);
                return;
            }

            const result = await bulkImportContactsToGroup(activeGroup.id, contactsToCreate);

            if (!result.success) {
                toast.error(result.error || "Failed to import contacts");
                setIsImportLoading(false);
                return;
            }

            const successResult = result as { createdCount: number; errorCount: number; errors: string[] };
            toast.success(`Successfully imported ${successResult.createdCount} contacts to ${activeGroup.name}`);
            if (successResult.errorCount > 0) {
                successResult.errors.forEach((errStr: string) => {
                    toast.error(errStr, { duration: 8000 });
                });
            }
                
                // Clear CSV states & return to main list
                setRawRows([]);
                setRawHeaders([]);
                setMappings({});
                setFileName("");
                setIsImportingCsv(false);
                
                // Reload data
                loadGroupContacts(activeGroup.id);
                loadGroups();
                router.refresh();
        } catch (error) {
            console.error("Import failed:", error);
            toast.error("Failed to import contacts");
        } finally {
            setIsImportLoading(false);
        }
    };

    const loadGroups = async () => {
        setIsLoading(true);
        try {
            const { groups: fetchedGroups } = await getGroups();
            setGroups(fetchedGroups as Group[]);
        } catch (error: any) {
            toast.error('Failed to load groups');
        } finally {
            setIsLoading(false);
        }
    };

    const loadGroupContacts = async (groupId: string) => {
        setIsContactsLoading(true);
        try {
            const contacts = await getGroupContacts(groupId);
            setActiveGroupContacts(contacts);
        } catch (error) {
            toast.error('Failed to load group contacts');
        } finally {
            setIsContactsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadGroups();
            setActiveGroup(null);
        }
    }, [isOpen]);

    useEffect(() => {
        if (activeGroup) {
            loadGroupContacts(activeGroup.id);
            setSearchQuery('');
            setSearchResults([]);
            setDirectNumber('');
        }
    }, [activeGroup]);

    // Live search existing contacts
    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (searchQuery.trim().length >= 2) {
                setIsSearchingContacts(true);
                try {
                    const results = await getContactsLight(searchQuery);
                    // Filter out already added contacts
                    const filtered = results.filter(
                        r => !activeGroupContacts.some(c => c.id === r.id)
                    );
                    setSearchResults(filtered);
                } catch (error) {
                    console.error('Search failed:', error);
                } finally {
                    setIsSearchingContacts(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery, activeGroupContacts]);

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim()) return toast.error('Group name required');
        try {
            await updateGroup(id, { name: editName });
            toast.success('Group updated');
            setEditingId(null);
            loadGroups();
        } catch (error: any) {
            toast.error(error.message || 'Update failed');
        }
    };

    const handleAddContactFromSearch = async (contactId: string) => {
        if (!activeGroup) return;
        try {
            await addContactsToGroup(activeGroup.id, [contactId]);
            toast.success('Contact added to group');
            setSearchQuery('');
            setSearchResults([]);
            loadGroupContacts(activeGroup.id);
            loadGroups(); // reload counts
            router.refresh();
        } catch (error) {
            toast.error('Failed to add contact');
        }
    };

    const handleAddDirectNumber = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeGroup) return;
        if (!directNumber.trim()) return toast.error('Please enter a phone number');
        
        setIsAddingNumber(true);
        try {
            await addNumberToGroup(activeGroup.id, directNumber);
            toast.success('Number added to group successfully');
            setDirectNumber('');
            loadGroupContacts(activeGroup.id);
            loadGroups(); // reload counts
            router.refresh();
        } catch (error: any) {
            toast.error(error.message || 'Failed to add number');
        } finally {
            setIsAddingNumber(false);
        }
    };

    const handleRemoveContact = async (contactId: string) => {
        if (!activeGroup) return;
        try {
            await removeContactFromGroup(activeGroup.id, contactId);
            toast.success('Contact removed from group');
            loadGroupContacts(activeGroup.id);
            loadGroups(); // reload counts
            router.refresh();
        } catch (error) {
            toast.error('Failed to remove contact');
        }
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="sm:max-w-[550px] p-0 gap-0 bg-white dark:bg-slate-900 border-none shadow-[0_32px_64px_-15px_rgba(0,0,0,0.2)] overflow-hidden rounded-[2rem] plus-jakarta-forced">
                    
                    {/* View 1: Main Groups Directory */}
                    {!activeGroup ? (
                        <>
                            {/* Premium Header */}
                            <div className="p-6 pb-2">
                                <DialogTitle className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                    <Users className="w-6 h-6 text-[#00B074]" /> Manage Groups
                                </DialogTitle>
                                <p className="text-[12px] text-slate-400 dark:text-slate-500 font-semibold mt-1">
                                    Create and organize segments to broadcast campaigns to your contacts.
                                </p>
                                
                                {/* Inline Actions Toolbar */}
                                <div className="mt-5 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/50 p-2 rounded-xl">
                                    <span className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider pl-2">
                                        Available Segments ({groups.length})
                                    </span>
                                    <Button
                                        onClick={() => setIsCreateModalOpen(true)}
                                        className="h-8 px-3 rounded-lg bg-[#00B074] hover:bg-[#009662] text-white text-xs font-extrabold shadow-sm active:scale-95 transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5 mr-1" />
                                        New Group
                                    </Button>
                                </div>
                            </div>

                            {/* Scrollable Content Area */}
                            <div className="px-6 pb-6 max-h-[50vh] overflow-y-auto no-scrollbar space-y-3">
                                {isLoading ? (
                                    <div className="flex flex-col items-center py-16 space-y-4">
                                        <div className="w-8 h-8 border-4 border-[#00B074]/30 border-t-[#00B074] rounded-full animate-spin" />
                                        <p className="text-xs font-bold text-slate-400">Syncing segments...</p>
                                    </div>
                                ) : groups.length === 0 ? (
                                    <div className="text-center py-16 bg-slate-50/30 dark:bg-slate-800/10 rounded-2.5xl border border-dashed border-slate-200 dark:border-slate-800">
                                        <Users className="h-10 w-10 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                                        <p className="text-slate-850 dark:text-slate-250 font-bold text-sm">No groups found</p>
                                        <p className="text-[11px] text-slate-400 mt-1">Add a group to start segmenting your contacts.</p>
                                    </div>
                                ) : (
                                    groups.map((group) => (
                                        <div
                                            key={group.id}
                                            onClick={() => setActiveGroup(group)}
                                            className="group relative flex items-center gap-4 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/40 bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 cursor-pointer transition-all duration-300"
                                        >
                                            {/* Accent Pill */}
                                            <div
                                                className="w-1.5 h-10 rounded-full shrink-0 shadow-[0_0_10px_rgba(0,0,0,0.05)]"
                                                style={{ backgroundColor: group.color || '#00B074' }}
                                            />
                                            
                                            {editingId === group.id ? (
                                                <div className="flex-1 flex gap-2 animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
                                                    <Input
                                                        value={editName}
                                                        onChange={(e) => setEditName(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit(group.id)}
                                                        className="h-10 rounded-xl border-[#00B074]/30 bg-white dark:bg-slate-900 focus-visible:ring-[#00B074] text-xs font-bold"
                                                        autoFocus
                                                    />
                                                    <Button 
                                                        onClick={() => handleSaveEdit(group.id)}
                                                        className="rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-xs font-bold"
                                                    >
                                                        Save
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2.5">
                                                        <h4 className="font-extrabold text-slate-800 dark:text-slate-200 text-sm truncate">
                                                            {group.name}
                                                        </h4>
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-[9px] font-extrabold text-[#00B074] dark:text-emerald-400 border border-emerald-100/40">
                                                            {group._count.contacts} contacts
                                                        </span>
                                                    </div>
                                                    {group.description ? (
                                                        <p className="text-[10px] font-semibold text-slate-400 mt-1 truncate leading-relaxed">
                                                            {group.description}
                                                        </p>
                                                    ) : (
                                                        <p className="text-[10px] font-semibold text-slate-350 dark:text-slate-650 mt-1 truncate italic">
                                                            Click card to add/manage segment contacts.
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            
                                            {/* Action Buttons */}
                                            <div className="flex gap-1 opacity-80 group-hover:opacity-100 transition-all duration-300" onClick={(e) => e.stopPropagation()}>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-[#00B074] hover:shadow-sm"
                                                    onClick={() => {
                                                        router.push(`/dashboard/contacts?groupId=${group.id}`);
                                                        onClose();
                                                    }}
                                                    title="View in table"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-500 hover:shadow-sm"
                                                    onClick={() => {
                                                        setEditingId(group.id);
                                                        setEditName(group.name);
                                                    }}
                                                    title="Edit name"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500"
                                                    onClick={() => {
                                                        if (confirm(`Delete ${group.name}?`)) deleteGroup(group.id).then(loadGroups);
                                                    }}
                                                    title="Delete group"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        /* View 2: Group Contacts Manager (Deep Management View) */
                        <>
                            {/* Premium Header */}
                            <div className="p-6 pb-2">
                                {isImportingCsv ? (
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            setIsImportingCsv(false);
                                            setRawRows([]);
                                            setRawHeaders([]);
                                            setFileName("");
                                        }}
                                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#00B074] transition-colors mb-3"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Group Contacts
                                    </button>
                                ) : (
                                    <button 
                                        type="button"
                                        onClick={() => setActiveGroup(null)}
                                        className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-[#00B074] transition-colors mb-3"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" /> Back to Groups
                                    </button>
                                )}
                                
                                <DialogTitle className="text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                                    {isImportingCsv ? (
                                        <>
                                            <FileSpreadsheet className="w-5.5 h-5.5 text-[#00B074]" /> Import Group Contacts
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-5.5 h-5.5 text-[#00B074]" /> Manage Group Contacts
                                        </>
                                    )}
                                </DialogTitle>
                                
                                <div className="flex items-center gap-2 mt-1.5">
                                    <div 
                                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                                        style={{ backgroundColor: activeGroup.color || '#00B074' }}
                                    />
                                    <span className="text-[12px] font-extrabold text-slate-700 dark:text-slate-350">
                                        Segment: {activeGroup.name}
                                    </span>
                                    <span className="text-[10px] font-bold text-[#00B074] bg-[#00B074]/10 px-2 py-0.5 rounded-full">
                                        {activeGroupContacts.length} contacts
                                    </span>
                                </div>

                                {!isImportingCsv && (
                                    <div className="mt-5">
                                        <Button
                                            type="button"
                                            onClick={() => setIsImportingCsv(true)}
                                            className="w-full h-11 rounded-2xl bg-[#00B074]/10 hover:bg-[#00B074]/20 border border-[#00B074]/20 hover:border-[#00B074]/40 text-[#00B074] text-xs font-black flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm"
                                        >
                                            <Upload className="w-4 h-4 text-[#00B074]" /> Import Contacts from CSV / Excel
                                        </Button>
                                    </div>
                                )}
                            </div>

                            {isImportingCsv ? (
                                /* CSV / Excel Import subview */
                                <div className="px-6 pb-6 space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar">
                                    {!rawRows.length ? (
                                        <div
                                            className="border-2 border-dashed border-[#7ED7B5] dark:border-emerald-700/80 rounded-[1.5rem] p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-50/5 dark:hover:bg-slate-800/20 transition-all group"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            <input
                                                type="file"
                                                ref={fileInputRef}
                                                onChange={handleFileUpload}
                                                accept=".xlsx, .xls, .csv"
                                                className="hidden"
                                            />
                                            <div className="bg-[#7ED7B5]/10 p-4 rounded-2xl mb-4 group-hover:scale-105 transition-all">
                                                <Upload className="w-6 h-6 text-[#00B074]" />
                                            </div>
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">
                                                Click to upload or drag and drop
                                            </h3>
                                            <p className="text-[10px] text-slate-400 font-semibold max-w-sm">
                                                Supported formats: .xlsx, .xls, .csv sheet files
                                            </p>
                                            
                                            <div className="mt-4 bg-[#F8FAFC] dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-800/50 px-4 py-3 rounded-[1rem] w-full max-w-md flex flex-col items-center justify-center">
                                                <p className="font-semibold text-slate-400 tracking-wider text-[9px] mb-1">
                                                    Recommended sheet headers:
                                                </p>
                                                <p className="font-semibold text-[10px] text-slate-500 dark:text-slate-400">
                                                    Name, Mobile Number, Email, Date of Birth, Tags, Source
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* File Info Card */}
                                            <div className="bg-slate-50 dark:bg-slate-800/30 border border-slate-100/55 dark:border-slate-800/55 p-4 rounded-xl flex items-center justify-between">
                                                <div>
                                                  <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate max-w-[200px]">
                                                    {fileName}
                                                  </h4>
                                                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                                                    <span className="text-[#00B074] font-bold">{rawRows.length}</span> rows detected
                                                  </p>
                                                </div>
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setRawRows([]);
                                                    setRawHeaders([]);
                                                    setFileName("");
                                                    if (fileInputRef.current) fileInputRef.current.value = "";
                                                  }}
                                                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-350 dark:hover:border-slate-600 rounded-lg text-[10px] font-semibold text-slate-600 dark:text-slate-300 transition-all"
                                                >
                                                  Change File
                                                </button>
                                            </div>

                                            {/* Column Mapping Section */}
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                                                  <span className="text-[9px] font-semibold text-slate-400 tracking-wider">
                                                    Attributes
                                                  </span>
                                                  <span className="text-[9px] font-semibold text-slate-400 tracking-wider">
                                                    Map from Column
                                                  </span>
                                                </div>

                                                <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1 no-scrollbar">
                                                  {TARGET_ATTRIBUTES.map((attr) => (
                                                    <div key={attr.key} className="grid grid-cols-2 gap-4 items-center">
                                                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate flex items-center gap-1">
                                                        {attr.label}
                                                        {attr.required && <span className="text-red-500 font-bold text-xs">*</span>}
                                                      </span>
                                                      <div>
                                                        <select
                                                          value={mappings[attr.key] || ""}
                                                          onChange={(e) => {
                                                            setMappings((prev) => ({
                                                              ...prev,
                                                              [attr.key]: e.target.value,
                                                            }));
                                                          }}
                                                          className="w-full h-9 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/60 dark:border-slate-800 rounded-lg px-3 text-[11px] font-bold text-slate-750 dark:text-slate-200 outline-none cursor-pointer appearance-none transition-all"
                                                          style={{
                                                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpath d='m6 9 6 6 6-6'/%3e%3c/svg%3e")`,
                                                            backgroundRepeat: "no-repeat",
                                                            backgroundPosition: "right 12px center",
                                                            backgroundSize: "12px",
                                                            paddingRight: "30px"
                                                          }}
                                                        >
                                                          <option value="" className="text-slate-400 dark:bg-slate-900">
                                                            Select Column
                                                          </option>
                                                          <option value="none" className="text-slate-450 dark:bg-slate-900 font-medium">
                                                            Ignore Column
                                                          </option>
                                                          {rawHeaders.map((h) => (
                                                            <option key={h} value={h} className="text-slate-800 dark:text-slate-100 dark:bg-slate-900 font-bold">
                                                              {h}
                                                            </option>
                                                          ))}
                                                        </select>
                                                      </div>
                                                    </div>
                                                  ))}
                                                </div>
                                            </div>

                                            {/* Import Action Buttons */}
                                            <div className="pt-2 flex justify-end gap-3">
                                                <Button
                                                    variant="outline"
                                                    type="button"
                                                    onClick={() => {
                                                        setIsImportingCsv(false);
                                                        setRawRows([]);
                                                        setRawHeaders([]);
                                                        setFileName("");
                                                    }}
                                                    className="rounded-xl h-10 px-5 text-xs font-extrabold"
                                                >
                                                    Cancel
                                                </Button>
                                                <Button
                                                    type="button"
                                                    onClick={handleCsvImport}
                                                    disabled={rawRows.length === 0 || isImportLoading}
                                                    className="bg-[#00B074] hover:bg-[#009662] text-white rounded-xl h-10 px-5 text-xs font-extrabold flex items-center gap-2"
                                                >
                                                    {isImportLoading ? (
                                                        <>
                                                            <Loader2 className="w-4 h-4 animate-spin" /> Importing...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="w-4 h-4" /> Import Contacts
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Scrollable Members list */
                                <div className="px-6 pb-6 max-h-[30vh] overflow-y-auto no-scrollbar space-y-2">
                                    <span className="text-[9px] font-extrabold text-slate-450 dark:text-slate-500 uppercase tracking-wider pl-1 mt-1 block">
                                        Current Group Members ({activeGroupContacts.length})
                                    </span>
                                    
                                    {isContactsLoading ? (
                                        <div className="flex flex-col items-center py-8 space-y-2">
                                            <Loader2 className="w-6.5 h-6.5 text-[#00B074] animate-spin" />
                                            <p className="text-[10px] font-bold text-slate-400">Loading members list...</p>
                                        </div>
                                    ) : activeGroupContacts.length === 0 ? (
                                        <div className="text-center py-8 bg-slate-50/30 dark:bg-slate-800/10 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                            <Users className="h-6 w-6 mx-auto mb-2 text-slate-350 dark:text-slate-650" />
                                            <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">No members in this group yet</p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">Use the inputs above to add your first segment contacts.</p>
                                        </div>
                                    ) : (
                                        activeGroupContacts.map(c => (
                                            <div 
                                                key={c.id}
                                                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800/50 bg-slate-50/30 dark:bg-slate-800/10 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <Avatar className="h-8 w-8 rounded-full shrink-0">
                                                        <AvatarImage src={c.profilePic || undefined} />
                                                        <AvatarFallback className="bg-[#00B074]/10 text-[#00B074] font-bold text-xs">
                                                            {(c.name || c.waId).substring(0, 2).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="text-xs font-bold text-slate-850 dark:text-slate-200 truncate leading-none mb-1">
                                                            {c.name || 'No Name'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-semibold leading-none">
                                                            +{c.waId}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => handleRemoveContact(c.id)}
                                                    className="h-8 w-8 rounded-xl text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-500"
                                                    title="Remove from group"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </DialogContent>
            </Dialog>

            <CreateGroupModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => {
                    setIsCreateModalOpen(false);
                    loadGroups();
                }}
            />
        </>
    );
}