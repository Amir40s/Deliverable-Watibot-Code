import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { Table, Copy, Trash2, Plus, X, Database, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export const GoogleSheetsNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
    const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();

    // State
    const [spreadsheetId, setSpreadsheetId] = useState(data.spreadsheetId || '');
    const [sheetName, setSheetName] = useState(data.sheetName || 'Sheet1');
    const [mappings, setMappings] = useState<{ column: string, attribute: string }[]>(data.mappings || [{ column: '', attribute: '' }]);
    const [isValidating, setIsValidating] = useState(false);
    const [validationResult, setValidationResult] = useState<{ success: boolean, title?: string } | null>(null);

    const handleVerifyAccess = async () => {
        if (!spreadsheetId) {
            toast.error("Please enter a Spreadsheet ID first");
            return;
        }

        setIsValidating(true);
        try {
            const { validateGoogleSheet } = await import('@/app/actions/flows');
            const result = await validateGoogleSheet(spreadsheetId) as any;
            if (result.success) {
                setValidationResult({ success: true, title: result.title });
                toast.success(`Access Verified: "${result.title}"`);
            } else {
                setValidationResult({ success: false });
                toast.error(result.error || "Failed to verify access");
            }
        } catch (error) {
            setValidationResult({ success: false });
            toast.error("An error occurred while verifying access");
        } finally {
            setIsValidating(false);
        }
    };

    const updateNodeData = (newData: any) => {
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
            )
        );
    };

    const handleDelete = () => {
        deleteElements({ nodes: [{ id }] });
    };

    const handleCopy = () => {
        const node = getNode(id);
        if (!node) return;

        addNodes({
            ...node,
            selected: false,
            dragging: false,
            id: `${node.type}-${Date.now()}`,
            position: { x: node.position.x + 50, y: node.position.y + 50 },
        });
        toast.success(tCommon("nodeDuplicated"));
    };

    const addMapping = () => {
        const newMappings = [...mappings, { column: '', attribute: '' }];
        setMappings(newMappings);
        updateNodeData({ mappings: newMappings });
    };

    const removeMapping = (index: number) => {
        const newMappings = mappings.filter((_, i) => i !== index);
        setMappings(newMappings);
        updateNodeData({ mappings: newMappings });
    };

    const updateMapping = (index: number, field: 'column' | 'attribute', value: string) => {
        const newMappings = mappings.map((m, i) => i === index ? { ...m, [field]: value } : m);
        setMappings(newMappings);
        updateNodeData({ mappings: newMappings });
    };

    return (
        <div className="relative group/node">
            {/* Top Menu */}
            {selected && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-1.5 z-20 animate-in fade-in zoom-in slide-in-from-bottom-2 nodrag nopan">
                    <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-300 transition-colors">
                        <Copy className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className={cn(
                "w-[340px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border-2 border-transparent transition-all overflow-hidden focus:outline-none",
                selected ? "border-emerald-500 shadow-emerald-500/10 ring-4 ring-emerald-500/10" : 
                data.isHoveredDuringConnect ? "border-emerald-400 animate-pulse" :
                "border-slate-100 dark:border-slate-800"
            )}>
                {/* Target Handle */}
                <Handle 
                    type="target" 
                    position={Position.Left} 
                    className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!" 
                    style={{ pointerEvents: 'all' }}
                />

                {/* Header Area */}
                <div className="bg-slate-50/50 dark:bg-slate-800/50 flex items-center border-b border-slate-100 dark:border-slate-800 relative">
                    <div className="w-1.5 h-16 bg-emerald-500" />
                    <div className="flex items-center gap-4 px-6 py-4">
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                            <Database className="w-6 h-6 text-emerald-500" />
                        </div>
                        <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400 tracking-tight">{tNodes("googleSheets")}</span>
                    </div>
                    <Handle 
                        type="source" 
                        position={Position.Right} 
                        id="right" 
                        className="w-5! h-5! border-[3px]! border-white! bg-emerald-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50! cursor-crosshair! shadow-lg" 
                        style={{ pointerEvents: 'all' }}
                    />
                </div>

                {/* Content Container */}
                <div className="p-6 space-y-6">
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Sheet Config</label>
                            <button 
                                onClick={handleVerifyAccess} 
                                disabled={isValidating}
                                className={cn(
                                    "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all shadow-sm",
                                    validationResult?.success 
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                                    : "bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                                )}
                            >
                                {isValidating ? (
                                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : validationResult?.success ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                ) : null}
                                {isValidating ? "Verifying..." : validationResult?.success ? "Verified" : "Verify Access"}
                            </button>
                        </div>
                        
                        {/* Spreadsheet ID */}
                        <div className="space-y-2">
                             <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Spreadsheet ID</span>
                             <Input
                                 placeholder="Paste ID from URL..."
                                 value={spreadsheetId}
                                 onChange={(e) => {
                                     setSpreadsheetId(e.target.value);
                                     setValidationResult(null);
                                     updateNodeData({ spreadsheetId: e.target.value });
                                 }}
                                 className={cn(
                                     "bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus-visible:ring-emerald-500/20 px-4 nodrag nopan",
                                     validationResult?.success === false && "ring-2 ring-red-500/20 border-red-200"
                                 )}
                             />
                             {validationResult?.success && (
                                 <div className="flex items-center gap-1.5 px-1 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                     <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                     <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold italic truncate">
                                         Found: {validationResult.title}
                                     </span>
                                 </div>
                             )}
                        </div>

                        {/* Sheet Name */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Tab Name</span>
                            <Input
                                placeholder="e.g. Sheet1"
                                value={sheetName}
                                onChange={(e) => {
                                    setSheetName(e.target.value);
                                    updateNodeData({ sheetName: e.target.value });
                                }}
                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus-visible:ring-emerald-500/20 px-4 nodrag nopan"
                            />
                        </div>
                    </div>

                    {/* Mappings */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">Column Mapping</label>
                            <button 
                                onClick={addMapping} 
                                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 rounded-xl text-emerald-600 border border-slate-100 dark:border-slate-800 shadow-sm hover:scale-110 active:scale-95 transition-all"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            {mappings.map((mapping, index) => (
                                <div key={index} className="group/mapping flex gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="flex-1">
                                        <Input
                                            placeholder="Col A"
                                            value={mapping.column}
                                            onChange={(e) => updateMapping(index, 'column', e.target.value)}
                                            className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-10 text-[11px] font-bold rounded-xl shadow-sm focus-visible:ring-emerald-500/20 px-3 nodrag nopan"
                                        />
                                    </div>
                                    <div className="text-slate-300 font-bold">→</div>
                                    <div className="flex-1">
                                        <div className="relative">
                                            <Input
                                                placeholder="Attribute"
                                                value={mapping.attribute}
                                                onChange={(e) => updateMapping(index, 'attribute', e.target.value)}
                                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-10 text-[11px] font-bold rounded-xl shadow-sm focus-visible:ring-emerald-500/20 px-3 pl-6 nodrag nopan"
                                            />
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px]">$</span>
                                        </div>
                                    </div>
                                    {mappings.length > 1 && (
                                        <button 
                                            onClick={() => removeMapping(index)} 
                                            className="w-8 h-10 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="relative group/connect cursor-crosshair">
                        <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl h-14 flex items-center justify-center group-hover/connect:border-emerald-400 transition-all">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest group-hover/connect:text-emerald-500 transition-colors">After Save</span>
                        </div>
                        <Handle 
                            type="source" 
                            position={Position.Right} 
                            id="right" 
                            className="w-5! h-5! border-[3px]! border-white! bg-emerald-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50! cursor-crosshair! shadow-lg" 
                            style={{ pointerEvents: 'all' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

GoogleSheetsNode.displayName = 'GoogleSheetsNode';
