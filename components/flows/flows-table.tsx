'use client';

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale/ar';
import { hi } from 'date-fns/locale/hi';
import { bn } from 'date-fns/locale/bn';
import { enUS } from 'date-fns/locale/en-US';
import { useTranslations, useLocale } from 'next-intl';
import { MoreVertical, Play, Pause, Copy, Trash2, Edit, Activity, FileJson, Settings, Facebook, Instagram, MessageCircle, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { deleteFlow, duplicateFlow, toggleFlowStatus } from '@/app/actions/flows';
import { EditFlowSettingsModal } from './edit-flow-settings-modal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useSession } from 'next-auth/react';
import { Flow } from '@/types/flow';

interface FlowsTableProps {
    flows: Flow[];
}

export function FlowsTable({ flows: initialFlows }: FlowsTableProps) {
    const t = useTranslations("Flows");
    const locale = useLocale();
    const dir = ["ar", "ur", "hi", "bn"].includes(locale) ? "rtl" : "ltr";
    
    const dateLocales: Record<string, any> = { ur: ar, ar, hi, bn, en: enUS };
    const currentLocale = dateLocales[locale] || enUS;

    const { data: session } = useSession();
    const isAdmin = session?.user?.role === "ADMIN" || session?.user?.role === "SUPER_ADMIN";
    const userPerms = (session?.user?.permissions as any) || {};
    const canCreate = isAdmin || userPerms.flow_create === true || userPerms.flow_super === true;
    const canDelete = isAdmin || userPerms.flow_delete === true || userPerms.flow_super === true;

    const [flows, setFlows] = useState(initialFlows);
    const [loadingId, setLoadingId] = useState<string | null>(null);
    const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
    const [isEditSettingsOpen, setIsEditSettingsOpen] = useState(false);

    const handleToggleStatus = async (id: string, currentStatus: boolean) => {
        setLoadingId(id);
        try {
            await toggleFlowStatus(id, !currentStatus);
            setFlows(flows.map(f => f.id === id ? { ...f, isActive: !currentStatus } : f));
            toast.success(!currentStatus ? t("activatedSuccess") : t("deactivatedSuccess"));
        } catch (error) {
            console.error(error);
            toast.error(t("updateFailed"));
        } finally {
            setLoadingId(null);
        }
    };

    const handleDuplicate = async (id: string) => {
        setLoadingId(id);
        try {
            const result = await duplicateFlow(id);
            if (result.success && result.flow) {
                setFlows([result.flow as any, ...flows]);
                toast.success(t("duplicateSuccess"));
            } else {
                toast.error(result.error || t("duplicateFailed"));
            }
        } catch (error) {
            console.error(error);
            toast.error(t("duplicateFailed"));
        } finally {
            setLoadingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm(t("deleteConfirm"))) {
            return;
        }

        setLoadingId(id);
        try {
            await deleteFlow(id);
            setFlows(flows.filter(f => f.id !== id));
            toast.success(t("deleteSuccess"));
        } catch (error) {
            console.error(error);
            toast.error(t("deleteFailed"));
        } finally {
            setLoadingId(null);
        }
    };

    const handleExportJson = (flow: Flow) => {
        try {
            const exportData = {
                name: flow.name,
                description: flow.description,
                platform: flow.platform || 'ALL',
                trigger: flow.trigger,
                nodes: flow.nodes,
                edges: flow.edges,
                version: '1.0'
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${flow.name.replace(/\s+/g, '_')}_design.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success(t("exportJsonSuccess"));
        } catch (error) {
            console.error('Export failed:', error);
            toast.error(t("exportJsonFailed"));
        }
    };

    return (
        <div className="overflow-x-auto" dir={dir}>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800">
                        <th className="text-start py-4 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("name")}
                        </th>
                        <th className="text-start py-4 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("status")}
                        </th>
                        <th className="text-start py-4 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("platform")}
                        </th>
                        <th className="text-start py-4 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("trigger")}
                        </th>
                        <th className="text-start py-4 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("executions")}
                        </th>
                        <th className="text-start py-4 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("lastModified")}
                        </th>
                        <th className="text-end py-4 px-6 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            {t("actions")}
                        </th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                    {flows.map((flow) => (
                        <tr key={flow.id} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                            <td className="py-4 px-6">
                                <Link href={`/dashboard/flows/${flow.id}`} className="group block">
                                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 group-hover:text-emerald-600 transition-colors">
                                        {flow.name}
                                    </div>
                                    {flow.description && (
                                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                                            {flow.description}
                                        </div>
                                    )}
                                </Link>
                            </td>
                            <td className="py-4 px-6">
                                <Badge
                                    variant={flow.isActive ? 'default' : 'outline'}
                                    className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 h-auto ${flow.isActive
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                                            : 'bg-gray-50 text-gray-600 border-gray-200 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700'
                                        }`}
                                >
                                    {flow.isActive ? t("active") : t("inactive")}
                                </Badge>
                            </td>
                            <td className="py-4 px-6">
                                <div className="flex items-center gap-2">
                                    {flow.platform === 'WHATSAPP' && (
                                        <span className="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 p-1 rounded flex items-center justify-center">
                                            <MessageCircle className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                    {flow.platform === 'INSTAGRAM' && (
                                        <span className="text-pink-600 bg-pink-50 dark:bg-pink-900/20 p-1 rounded flex items-center justify-center">
                                            <Instagram className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                    {flow.platform === 'FACEBOOK' && (
                                        <span className="text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-1 rounded flex items-center justify-center">
                                            <Facebook className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                    {flow.platform === 'SHOPIFY' && (
                                        <span className="text-green-600 bg-green-50 dark:bg-green-900/20 p-1 rounded flex items-center justify-center">
                                            <ShoppingBag className="w-3.5 h-3.5" />
                                        </span>
                                    )}
                                    <Badge variant="outline" className="text-[10px] font-bold">
                                        {flow.platform || t("allPlatforms")}
                                    </Badge>
                                </div>
                            </td>
                            <td className="py-4 px-6">
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300 capitalize bg-gray-100 dark:bg-slate-800 px-2 py-1 rounded">
                                    {flow.trigger?.type || t("manual")}
                                </span>
                            </td>
                            <td className="py-4 px-6">
                                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                                    <Activity className="w-3.5 h-3.5 text-gray-400" />
                                    {flow._count?.executions || 0}
                                </div>
                            </td>
                            <td className="py-4 px-6">
                                <span className="text-xs text-gray-500 dark:text-gray-400 block min-w-[100px]">
                                    {formatDistanceToNow(new Date(flow.updatedAt), { addSuffix: true, locale: currentLocale })}
                                </span>
                            </td>
                            <td className={`py-4 px-6 ${dir === 'rtl' ? 'text-start' : 'text-end'}`}>
                                <DropdownMenu dir={dir}>
                                    <DropdownMenuTrigger
                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-400 hover:text-gray-600 transition-colors outline-none focus:ring-0"
                                        disabled={loadingId === flow.id}
                                    >
                                        <MoreVertical className="w-4 h-4" />
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align={dir === 'rtl' ? 'start' : 'end'} className="w-48 border-none shadow-xl dark:bg-slate-900">
                                        {canCreate && (
                                            <>
                                                <DropdownMenuItem asChild>
                                                    <Link href={`/dashboard/flows/${flow.id}`} className="flex items-center gap-2 cursor-pointer text-start">
                                                        <Edit className="w-4 h-4" />
                                                        {t("editFlow")}
                                                    </Link>
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => {
                                                        setEditingFlow(flow);
                                                        setIsEditSettingsOpen(true);
                                                    }}
                                                    className="flex items-center gap-2 cursor-pointer text-start"
                                                >
                                                    <Settings className="w-4 h-4" />
                                                    {t("settings")}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleToggleStatus(flow.id, flow.isActive)}
                                                    className="flex items-center gap-2 cursor-pointer text-start"
                                                >
                                                    {flow.isActive ? (
                                                        <>
                                                            <Pause className="w-4 h-4" />
                                                            {t("deactivate")}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="w-4 h-4" />
                                                            {t("activate")}
                                                        </>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onClick={() => handleDuplicate(flow.id)}
                                                    className="flex items-center gap-2 cursor-pointer text-start"
                                                >
                                                    <Copy className="w-4 h-4" />
                                                    {t("duplicate")}
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                        <DropdownMenuItem
                                            onClick={() => handleExportJson(flow)}
                                            className="flex items-center gap-2 cursor-pointer text-start"
                                        >
                                            <FileJson className="w-4 h-4" />
                                            {t("exportJson")}
                                        </DropdownMenuItem>
                                        {canDelete && (
                                            <>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => handleDelete(flow.id)}
                                                    className="flex items-center gap-2 text-red-600 focus:text-red-700 cursor-pointer text-start"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    {t("delete")}
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <EditFlowSettingsModal
                flow={editingFlow}
                isOpen={isEditSettingsOpen}
                onClose={() => {
                    setIsEditSettingsOpen(false);
                    setEditingFlow(null);
                }}
                onSuccess={(updatedFlow) => {
                    setFlows(flows.map(f => f.id === updatedFlow.id ? updatedFlow : f));
                }}
            />
        </div>
    );
}
