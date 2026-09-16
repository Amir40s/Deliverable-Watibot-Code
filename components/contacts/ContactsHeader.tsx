'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Users, Upload, Plus, TrendingUp, TrendingDown, UserCheck, UserX, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ImportContactsModal } from './ImportContactsModal';
import { CreateContactModal } from './CreateContactModal';
import { CreateCustomFieldModal } from './CreateCustomFieldModal';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@/lib/permissions';
import { getQuotaStatus } from '@/app/actions/quota';

interface ContactsHeaderProps {
    total?: number;
    activeCount?: number;
    newImports?: number;
    blockedCount?: number;
}

export function ContactsHeader({ total = 0, activeCount = 0, newImports = 0, blockedCount = 0 }: ContactsHeaderProps) {
    const t = useTranslations('Contacts');

    const { data: session } = useSession();
    const router = useRouter();
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isCustomFieldModalOpen, setIsCustomFieldModalOpen] = useState(false);
    const [contactQuota, setContactQuota] = useState<{ allowed: boolean; limit: number; current: number } | null>(null);

    React.useEffect(() => {
        getQuotaStatus('maxContacts').then(status => {
            setContactQuota(status);
        }).catch(err => console.error('Failed to fetch contact quota:', err));
    }, []);

    const isContactLimitReached = contactQuota ? !contactQuota.allowed : false;

    const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.role === 'SUPER_ADMIN';
    const canCreate = hasPermission(session, ['contacts', 'contacts:Add / Edit Contacts']);
    const canImport = isAdmin;

    const stats = [
        {
            label: t('totalContacts'),
            value: total.toLocaleString(),
            change: '+12.8%',
            trend: 'up',
            icon: <Users className="w-5 h-5" />,
            color: 'emerald',
            bg: 'bg-emerald-50 dark:bg-emerald-950/20',
            border: 'border-emerald-100/60 dark:border-emerald-900/30',
            iconBg: 'bg-emerald-500/10 dark:bg-emerald-500/20',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            valueColor: 'text-emerald-700 dark:text-emerald-300',
            labelColor: 'text-emerald-600/80 dark:text-emerald-400/80',
        },
        {
            label: t('activeContacts'),
            value: activeCount.toLocaleString(),
            change: '+6.4%',
            trend: 'up',
            icon: <UserCheck className="w-5 h-5" />,
            color: 'indigo',
            bg: 'bg-indigo-50 dark:bg-indigo-950/20',
            border: 'border-indigo-100/60 dark:border-indigo-900/30',
            iconBg: 'bg-indigo-500/10 dark:bg-indigo-500/20',
            iconColor: 'text-indigo-600 dark:text-indigo-400',
            valueColor: 'text-indigo-700 dark:text-indigo-300',
            labelColor: 'text-indigo-600/80 dark:text-indigo-400/80',
        },
        {
            label: t('newImports'),
            value: newImports.toLocaleString(),
            change: '+16.7%',
            trend: 'up',
            icon: <UserPlus className="w-5 h-5" />,
            color: 'violet',
            bg: 'bg-violet-50 dark:bg-violet-950/20',
            border: 'border-violet-100/60 dark:border-violet-900/30',
            iconBg: 'bg-violet-500/10 dark:bg-violet-500/20',
            iconColor: 'text-violet-600 dark:text-violet-400',
            valueColor: 'text-violet-700 dark:text-violet-300',
            labelColor: 'text-violet-600/80 dark:text-violet-400/80',
        },
        {
            label: t('blockedContacts'),
            value: blockedCount.toLocaleString(),
            change: '+2.6%',
            trend: 'up',
            icon: <UserX className="w-5 h-5" />,
            color: 'rose',
            bg: 'bg-rose-50 dark:bg-rose-950/20',
            border: 'border-rose-100/60 dark:border-rose-900/30',
            iconBg: 'bg-rose-500/10 dark:bg-rose-500/20',
            iconColor: 'text-rose-600 dark:text-rose-400',
            valueColor: 'text-rose-700 dark:text-rose-300',
            labelColor: 'text-rose-600/80 dark:text-rose-400/80',
        },
    ];

    return (
        <>
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 pb-1">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{t('title')}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {t('subtitle')}
                    </p>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 w-full sm:flex-nowrap sm:w-auto sm:shrink-0">
                    {canImport && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            disabled={isContactLimitReached}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-3 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm whitespace-nowrap ${
                                isContactLimitReached ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                            }`}
                        >
                            <Upload className="w-3.5 h-3.5 text-slate-500" />
                            <span>{t('importContacts')}</span>
                        </button>
                    )}
                    {canCreate && (
                        <>
                            <button
                                onClick={() => setIsCustomFieldModalOpen(true)}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-3 sm:px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs sm:text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm whitespace-nowrap"
                            >
                                <Plus className="w-3.5 h-3.5 text-slate-500" />
                                <span>Custom Fields</span>
                            </button>
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                disabled={isContactLimitReached}
                                className={`flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-3 sm:px-4 rounded-xl bg-[#00B074] hover:bg-[#009662] text-white text-xs sm:text-sm font-bold shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 active:scale-95 transition-all whitespace-nowrap ${
                                    isContactLimitReached ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''
                                }`}
                            >
                                <Plus className="w-4 h-4" />
                                <span>{t('addContact')}</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {isContactLimitReached && contactQuota && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full mt-2 mb-2 shadow-sm animate-in fade-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                            <Users className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-red-800 dark:text-red-300">Contact Limit Reached</h4>
                            <p className="text-xs text-red-700/80 dark:text-red-400/80 mt-0.5 font-medium">
                                You have reached your contact quota limit ({contactQuota.current}/{contactQuota.limit} contacts). Please upgrade your subscription plan to add or import more contacts.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/billing')}
                        className="h-10 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shrink-0 transition-all text-xs sm:text-sm shadow-sm cursor-pointer"
                    >
                        Upgrade Plan
                    </button>
                </div>
            )}

            {/* Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {stats.map((stat, i) => (
                    <div
                        key={i}
                        className={`flex items-center gap-3.5 ${stat.bg} border ${stat.border} rounded-2xl px-4 py-3.5 transition-all hover:shadow-sm`}
                    >
                        <div className={`p-2.5 ${stat.iconBg} ${stat.iconColor} rounded-xl shrink-0`}>
                            {stat.icon}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className={`text-[10px] font-bold ${stat.labelColor} uppercase tracking-wider leading-none mb-1.5`}>
                                {stat.label}
                            </span>
                            <span className={`text-2xl font-extrabold ${stat.valueColor} leading-none tracking-tight`}>
                                {stat.value}
                            </span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-1 flex items-center gap-1">
                                {stat.trend === 'up'
                                    ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                                    : <TrendingDown className="w-3 h-3 text-rose-500" />
                                }
                                <span className={stat.trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                                    {stat.change}
                                </span>
                                {' '}{t('vsLast30Days')}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modals */}
            <ImportContactsModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => router.refresh()}
            />
            <CreateContactModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={() => { router.refresh(); }}
                editData={null}
                contactIds={[]}
            />
            <CreateCustomFieldModal
                isOpen={isCustomFieldModalOpen}
                onClose={() => setIsCustomFieldModalOpen(false)}
                onSuccess={() => { router.refresh(); }}
            />
        </>
    );
}
