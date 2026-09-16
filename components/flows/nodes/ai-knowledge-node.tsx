import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { Database, Copy, Trash2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export const AIKnowledgeNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
    const { deleteElements, getNode, addNodes } = useReactFlow();

    const handleDelete = () => {
        deleteElements({ nodes: [{ id }] });
    };

    const handleCopy = () => {
        const node = getNode(id);
        if (!node) return;
        
        const position = {
            x: node.position.x + 50,
            y: node.position.y + 50,
        };

        addNodes({
            ...node,
            selected: false,
            dragging: false,
            id: `${node.type}-${Date.now()}`,
            position,
        });
        toast.success(tCommon("nodeDuplicated"));
    };

    return (
        <div className="relative group/node">
            {/* Top Menu (Horizontal) - Node-level actions */}
            {selected && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-1.5 z-20 animate-in fade-in zoom-in slide-in-from-bottom-2 nodrag nopan">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleCopy();
                        }} 
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-300 transition-colors"
                    >
                        <Copy className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete();
                        }} 
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className={cn(
                "w-[340px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border-2 border-transparent transition-all overflow-hidden",
                selected ? "border-indigo-500 shadow-indigo-500/10 ring-4 ring-indigo-500/10" : "border-slate-100 dark:border-slate-800"
            )}>
                <Handle
                    type="target"
                    position={Position.Left}
                    className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!"
                    style={{ pointerEvents: 'all' }}
                />

                {/* Header */}
                <div className="bg-slate-50/50 dark:bg-slate-800/50 flex items-center border-b border-slate-100 dark:border-slate-800">
                    <div className="w-1.5 h-16 bg-indigo-500" />
                    <div className="flex items-center gap-4 px-6 py-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                            <Database className="w-6 h-6 text-indigo-500" />
                        </div>
                        <span className="font-bold text-xl text-indigo-600 dark:text-indigo-400 tracking-tight">{data.label || tNodes("aIKnowledge")}</span>
                    </div>
                </div>

                {/* Content Container */}
                <div className="p-6">
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-2xl p-5 border border-slate-100/50 dark:border-slate-700/50 mb-6">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block mb-3">Active Intelligence</span>
                        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-semibold italic">
                            {data.agentName ? `Agent: ${data.agentName}` : "Using all Knowledge Base entries..."}
                        </p>
                    </div>

                    {/* Handles Section */}
                    <div className="space-y-4">
                        {/* GENERAL RESPONSE */}
                        <div className="flex items-center justify-end gap-3 group/handle py-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover/handle:text-emerald-500 transition-colors">General Response</span>
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20" />
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="general"
                                className="w-full! h-6! bg-transparent! border-none! absolute! right-0! z-50! opacity-0!"
                                style={{ pointerEvents: 'all' }}
                            />
                        </div>

                        {/* TRIGGER FORM */}
                        <div className="flex items-center justify-end gap-3 group/handle py-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover/handle:text-blue-500 transition-colors">Trigger Form</span>
                            <div className="w-3 h-3 rounded-full bg-blue-500 shadow-lg shadow-blue-500/20" />
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="form"
                                className="w-full! h-6! bg-transparent! border-none! absolute! right-0! z-50! opacity-0!"
                                style={{ pointerEvents: 'all' }}
                            />
                        </div>

                        {/* SAVE TO SHEETS */}
                        <div className="flex items-center justify-end gap-3 group/handle py-1">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 group-hover/handle:text-amber-500 transition-colors">Save to Sheets</span>
                            <div className="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-500/20" />
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="sheets"
                                className="w-full! h-6! bg-transparent! border-none! absolute! right-0! z-50! opacity-0!"
                                style={{ pointerEvents: 'all' }}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

AIKnowledgeNode.displayName = 'AIKnowledgeNode';
