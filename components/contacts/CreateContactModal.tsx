"use client";

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, X, Loader2, Plus, User, Phone, Tag, Info, ChevronDown, Check } from 'lucide-react';
import { getTags } from '@/app/actions/tags';
import { toast } from 'sonner';
import { countries } from '@/lib/countries';

function getEmojiFlag(flagUrl: string) {
    try {
        const match = flagUrl.match(/\/w40\/([a-z]{2})\.png/);
        if (!match) return '🌐';
        const iso = match[1].toUpperCase();
        return iso
            .split('')
            .map(char => String.fromCodePoint(char.charCodeAt(0) + 127397))
            .join('');
    } catch {
        return '🌐';
    }
}

interface CreateContactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editData?: any | null;
    contactIds?: string[];
}

export function CreateContactModal({ isOpen, onClose, onSuccess, editData, contactIds }: CreateContactModalProps) {
    const t = useTranslations('Contacts');

    const [isLoading, setIsLoading] = useState(false);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedCountry, setSelectedCountry] = useState(countries.find(c => c.name === 'Pakistan') || countries[0]);
    const [dob, setDob] = useState('');
    const [source, setSource] = useState('');
    const [dbTags, setDbTags] = useState<any[]>([]);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [tagSearchQuery, setTagSearchQuery] = useState('');

    // Custom Fields state
    const [customFieldsList, setCustomFieldsList] = useState<string[]>([]);
    const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
    const [newFieldName, setNewFieldName] = useState('');
    const [isCreatingField, setIsCreatingField] = useState(false);

    const handleAddCustomField = async () => {
        const trimmed = newFieldName.trim();
        if (!trimmed) return;
        
        const ignoredFields = ['starred', 'isStarred', 'wa_id', 'profile', 'user_id'];
        if (ignoredFields.includes(trimmed.toLowerCase())) {
            toast.error('This is a reserved system field name');
            return;
        }
        
        if (customFieldsList.includes(trimmed)) {
            toast.error('Field already exists');
            return;
        }
        
        setIsCreatingField(true);
        try {
            await createCustomAttribute(trimmed);
            setCustomFieldsList(prev => [...prev, trimmed]);
            setCustomFieldValues(prev => ({ ...prev, [trimmed]: '' }));
            setNewFieldName('');
            toast.success(`Custom field "${trimmed}" created successfully`);
        } catch (err: any) {
            toast.error(err.message || 'Failed to create field');
        } finally {
            setIsCreatingField(false);
        }
    };

    const filteredCountries = countries.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
        c.code.includes(searchQuery)
    );

    useEffect(() => {
        if (isOpen) {
            getTags().then(setDbTags).catch(console.error);
            getCustomAttributes().then((fields) => {
                setCustomFieldsList(fields);
                
                // Initialize field values
                if (editData) {
                    const existingVals = editData.customAttributes && typeof editData.customAttributes === 'object' && !Array.isArray(editData.customAttributes)
                        ? (editData.customAttributes as Record<string, string>)
                        : {};
                    
                    const initialVals: Record<string, string> = {};
                    fields.forEach(field => {
                        initialVals[field] = existingVals[field] || '';
                    });
                    setCustomFieldValues(initialVals);
                } else {
                    const initialVals: Record<string, string> = {};
                    fields.forEach(field => {
                        initialVals[field] = '';
                    });
                    setCustomFieldValues(initialVals);
                }
            }).catch(console.error);

            if (editData) {
                setName(editData.name || '');
                const fullPhone = editData.waId || '';
                
                // Try to find matching country code
                const country = countries.find(c => fullPhone.startsWith(c.code));
                if (country) {
                    setSelectedCountry(country);
                    setPhone(fullPhone.substring(country.code.length));
                } else {
                    setPhone(fullPhone);
                }

                const notesStr = editData.notes || '';
                const dobMatch = notesStr.match(/DOB:\s*([^,]+)/);
                setDob(dobMatch ? dobMatch[1].trim() : '');

                const sourceMatch = notesStr.match(/Source:\s*(.+)$/);
                setSource(sourceMatch ? sourceMatch[1].trim() : '');

                if (editData.tags) {
                    setSelectedTags(editData.tags.map((t: any) => t.id));
                } else {
                    setSelectedTags([]);
                }
            } else {
                // Reset for new creation
                setName('');
                setPhone('');
                setDob('');
                setSelectedTags([]);
                setSource('');
                setSelectedCountry(countries.find(c => c.name === 'Pakistan') || countries[0]);
                setIsDropdownOpen(false);
                setIsTagDropdownOpen(false);
                setSearchQuery('');
                setTagSearchQuery('');
                setCustomFieldValues({});
            }
        }
    }, [isOpen, editData]);

    const toggleTag = (id: string) => {
        setSelectedTags(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    };

    const handleSubmit = async () => {
        if (!name || !phone) {
            toast.error('Name and Phone Number are required');
            return;
        }

        setIsLoading(true);
        try {
            const cleanPhone = phone.replace(/[^0-9]/g, '');
            const fullPhone = `${selectedCountry.code.replace('-', '')}${cleanPhone}`;
            const notesStr = `DOB: ${dob}, Source: ${source}`;

            if (editData) {
                await updateContact(editData.id, {
                    name,
                    waId: fullPhone,
                    tagIds: selectedTags,
                    notes: notesStr,
                    customAttributes: customFieldValues
                });
                toast.success('Contact updated successfully');
            } else {
                await createContact({
                    name,
                    phoneNumber: fullPhone,
                    tagIds: selectedTags,
                    notes: notesStr,
                    customAttributes: customFieldValues
                });
                toast.success('Contact created successfully');
            }

            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.message || (editData ? 'Failed to update contact' : 'Failed to create contact'));
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl p-0 gap-0 bg-white dark:bg-slate-900 border-none rounded-[2rem] shadow-[0_32px_64px_-15px_rgba(0,0,0,0.2)] overflow-hidden plus-jakarta-forced">
                {/* Header Section */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div>
                        <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                            {editData ? t('editContact', { defaultValue: 'Edit Contact' }) : t('createNewContact')}
                        </DialogTitle>
                        <p className="text-[13px] text-slate-400 font-medium mt-0.5">{t('fillInformation')}</p>
                    </div>
                    
                </div>

                {/* Form Body */}
                <div className="px-8 py-8 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        
                        {/* Left Column */}
                        <div className="space-y-6">
                            {/* Name Input */}
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] px-1 flex justify-between">
                                    <span className="flex items-center gap-2"><User className="w-3 h-3 text-[#00B074]" /> {t('fullName')}</span>
                                    <span className="text-rose-500">*</span>
                                </Label>
                                <div className="relative">
                                    <Input
                                        placeholder={t('fullNamePlaceholder')}
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 h-12 rounded-xl text-sm px-4 focus-visible:ring-primary/10 focus-visible:border-primary transition-all font-medium placeholder:text-slate-400/80"
                                        maxLength={100}
                                    />
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">{name.length}/100</span>
                                    </div>
                                </div>
                            </div>

                            {/* Mobile Number Input */}
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] px-1 flex justify-between">
                                    <span className="flex items-center gap-2"><Phone className="w-3 h-3 text-[#00B074]" /> {t('mobileNumber')}</span>
                                    <span className="text-rose-500">*</span>
                                </Label>
                                <div className="flex gap-2">
                                    {/* Custom-styled Dropdown for Country Code with Real Flag Images */}
                                    <div className="relative w-[130px] shrink-0">
                                        <div 
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className="h-12 w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl px-3 flex items-center justify-between cursor-pointer select-none active:scale-[0.98] transition-all"
                                        >
                                            <div className="flex items-center gap-2">
                                                <img 
                                                    src={selectedCountry.flag} 
                                                    alt={selectedCountry.name}
                                                    className="w-5 h-3.5 object-cover rounded-[2px] shadow-sm shrink-0 border border-slate-100 dark:border-slate-800" 
                                                />
                                                <span className="text-[12.5px] font-bold text-slate-800 dark:text-slate-200">
                                                    {selectedCountry.code}
                                                </span>
                                            </div>
                                            <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                        </div>

                                        {isDropdownOpen && (
                                            <>
                                                {/* Global overlay backdrop to close dropdown */}
                                                <div 
                                                    className="fixed inset-0 z-[80]" 
                                                    onClick={() => setIsDropdownOpen(false)} 
                                                />
                                                
                                                {/* Dropdown Options List */}
                                                <div className="absolute top-[52px] left-0 w-[140px] bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-[0_12px_36px_rgba(0,0,0,0.15)] z-[90] p-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150 plus-jakarta-forced">
                                                    <div className="px-1.5 pt-1">
                                                        <Input
                                                            placeholder="Search country..."
                                                            value={searchQuery}
                                                            onChange={(e) => setSearchQuery(e.target.value)}
                                                            className="h-9 px-3 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border-none font-semibold focus-visible:ring-primary/20"
                                                            autoFocus
                                                        />
                                                    </div>
                                                    
                                                    <div className="max-h-[200px] overflow-y-auto space-y-0.5 no-scrollbar pr-0.5">
                                                        {filteredCountries.length > 0 ? (
                                                            filteredCountries.map((c) => (
                                                                <button
                                                                    type="button"
                                                                    key={c.name}
                                                                    onClick={() => {
                                                                        setSelectedCountry(c);
                                                                        setIsDropdownOpen(false);
                                                                        setSearchQuery('');
                                                                    }}
                                                                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group"
                                                                >
                                                                    <img 
                                                                        src={c.flag} 
                                                                        alt={c.name}
                                                                        className="w-5 h-3.5 object-cover rounded-[2px] shadow-sm shrink-0 border border-slate-100 dark:border-slate-800" 
                                                                    />
                                                                    <span className="text-[12px] font-extrabold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                                                                        {c.code}
                                                                    </span>
                                                                    <span className="text-[10px] font-bold text-slate-400 truncate flex-1">
                                                                        {c.name}
                                                                    </span>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="text-center py-4 text-xs font-semibold text-slate-400">
                                                                No countries found
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>

                                    {/* Number Input */}
                                    <div className="flex-1">
                                        <Input
                                            placeholder="300 1234567"
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                            className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 h-12 rounded-xl text-sm px-4 focus-visible:ring-primary/10 transition-all font-semibold"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* Date of Birth Input */}
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] px-1 flex items-center gap-2">
                                    <CalendarIcon className="w-3 h-3 text-[#00B074]" /> {t('dateOfBirth')}
                                </Label>
                                <Input
                                    type="date"
                                    value={dob}
                                    onChange={(e) => setDob(e.target.value)}
                                    className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 h-12 rounded-xl text-sm px-4 focus-visible:ring-primary/10 font-medium text-slate-700 dark:text-slate-200"
                                />
                            </div>

                            {/* Lead Source Input */}
                            <div className="space-y-2">
                                <Label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] px-1 flex items-center gap-2">
                                    <Info className="w-3 h-3 text-[#00B074]" /> {t('leadSource')}
                                </Label>
                                <Input
                                    placeholder={t('leadSourcePlaceholder')}
                                    value={source}
                                    onChange={(e) => setSource(e.target.value)}
                                    className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 h-12 rounded-xl text-sm px-4 focus-visible:ring-primary/10 font-medium placeholder:text-slate-400/80"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Bottom Inline Tag Selector Section (Dropdown Layout) */}
                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-3">
                            <Label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] px-1 flex items-center gap-2">
                                <Tag className="w-3 h-3 text-[#00B074]" /> {t('selectTags')}
                            </Label>
                            
                            <div className="relative">
                                {/* Dropdown Trigger Button */}
                                <div 
                                    onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                                    className="min-h-12 w-full bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 rounded-xl px-4 py-2 flex items-center justify-between cursor-pointer select-none active:scale-[0.99] transition-all"
                                >
                                    <div className="flex flex-wrap gap-1.5 items-center">
                                        {selectedTags.length > 0 ? (
                                            dbTags.filter(tag => selectedTags.includes(tag.id)).map(tag => (
                                                <span 
                                                    key={tag.id}
                                                    className="text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider text-white flex items-center gap-1 border-0 shadow-sm"
                                                    style={{ backgroundColor: tag.color || '#6366F1' }}
                                                >
                                                    {tag.name}
                                                    <button 
                                                        type="button" 
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleTag(tag.id);
                                                        }}
                                                        className="hover:bg-white/20 rounded-full p-0.5"
                                                    >
                                                        <X className="w-3 h-3 text-white" />
                                                    </button>
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-slate-400 font-semibold text-sm">Select Tags & Labels</span>
                                        )}
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ms-2 ${isTagDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>

                                {isTagDropdownOpen && (
                                    <>
                                        {/* Backdrop overlay */}
                                        <div 
                                            className="fixed inset-0 z-[80]" 
                                            onClick={() => {
                                                setIsTagDropdownOpen(false);
                                                setTagSearchQuery('');
                                            }} 
                                        />
                                        
                                        {/* Dropdown Menu */}
                                        <div className="absolute top-[54px] left-0 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] z-[90] p-3 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150 plus-jakarta-forced">
                                            {/* Search inside dropdown */}
                                            <div className="relative">
                                                <Input
                                                    placeholder="Search tags & labels..."
                                                    value={tagSearchQuery}
                                                    onChange={(e) => setTagSearchQuery(e.target.value)}
                                                    className="h-10 px-3 rounded-lg text-xs bg-slate-50 dark:bg-slate-800 border-none font-semibold focus-visible:ring-primary/20"
                                                    autoFocus
                                                />
                                            </div>

                                            {/* Scrollable list */}
                                            <div className="max-h-[220px] overflow-y-auto space-y-1 pr-1">
                                                {dbTags.filter(tag => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase())).length > 0 ? (
                                                    dbTags
                                                        .filter(tag => tag.name.toLowerCase().includes(tagSearchQuery.toLowerCase()))
                                                        .map(tag => {
                                                            const isSelected = selectedTags.includes(tag.id);
                                                            const tagColor = tag.color || '#6366F1';
                                                            return (
                                                                <button
                                                                    type="button"
                                                                    key={tag.id}
                                                                    onClick={() => toggleTag(tag.id)}
                                                                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all text-left group"
                                                                >
                                                                    <div className="flex items-center gap-2.5">
                                                                        <span 
                                                                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/20 shadow-sm"
                                                                            style={{ backgroundColor: tagColor }}
                                                                        />
                                                                        <span className="text-[12.5px] font-extrabold text-slate-800 dark:text-slate-200 group-hover:text-primary transition-colors">
                                                                            {tag.name}
                                                                        </span>
                                                                    </div>
                                                                    
                                                                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                                                        isSelected 
                                                                            ? 'bg-[#00B074] border-[#00B074] text-white' 
                                                                            : 'border-slate-300 dark:border-slate-650'
                                                                    }`}>
                                                                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                                                    </div>
                                                                </button>
                                                            );
                                                        })
                                                ) : (
                                                    <div className="text-center py-6 text-xs font-semibold text-slate-400 italic">
                                                        No matching tags found
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Custom Fields Section */}
                    <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="space-y-4">
                            <Label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em] px-1 flex items-center gap-2">
                                <Plus className="w-3 h-3 text-[#00B074]" /> Custom Fields
                            </Label>
                            
                            {customFieldsList.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                                    {customFieldsList.map((field) => (
                                        <div key={field} className="space-y-2">
                                            <Label className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase px-1">
                                                {field}
                                            </Label>
                                            <Input
                                                placeholder={`Enter ${field}...`}
                                                value={customFieldValues[field] || ''}
                                                onChange={(e) => setCustomFieldValues(prev => ({ ...prev, [field]: e.target.value }))}
                                                className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 h-12 rounded-xl text-sm px-4 focus-visible:ring-primary/10 transition-all font-medium placeholder:text-slate-400/80"
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs font-semibold text-slate-400 italic px-1">No custom fields defined yet.</p>
                            )}

                            {/* Add custom field inline */}
                            <div className="flex gap-2 items-end pt-2 max-w-md">
                                <div className="flex-1 space-y-2">
                                    <Label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase px-1">
                                        Add new custom field definition
                                    </Label>
                                    <Input
                                        placeholder="New Field Name (e.g. Anniversary)"
                                        value={newFieldName}
                                        onChange={(e) => setNewFieldName(e.target.value)}
                                        className="bg-slate-50/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/50 h-10 rounded-xl text-xs px-4 focus-visible:ring-primary/10 transition-all font-medium placeholder:text-slate-400/80"
                                        maxLength={50}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAddCustomField();
                                            }
                                        }}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    onClick={handleAddCustomField}
                                    disabled={isCreatingField}
                                    className="h-10 px-4 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-md text-xs cursor-pointer"
                                >
                                    {isCreatingField ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Add'}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-8 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900 flex justify-end gap-3">
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="h-12 px-6 rounded-xl font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        {t('cancel')}
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={isLoading}
                        className="h-12 px-8 rounded-xl font-bold bg-[#00B074] hover:bg-[#009c66] text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-emerald-500/20 min-w-[160px]"
                    >
                        {isLoading ? (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>{t('saving', { defaultValue: 'Saving...' })}</span>
                            </div>
                        ) : (
                            <span>{editData ? t('saveChanges', { defaultValue: 'Save Changes' }) : t('createContact')}</span>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
