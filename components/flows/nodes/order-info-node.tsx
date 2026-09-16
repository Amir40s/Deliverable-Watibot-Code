import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { ShoppingBag, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';

export const OrderInfoNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
    const { deleteElements, getNode, addNodes } = useReactFlow();

    const handleDelete = () => {
        deleteElements({ nodes: [{ id }] });
        toast.success("Node deleted");
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
                        title="Duplicate"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDelete();
                        }} 
                        className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl text-red-600 transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className={cn(
                "relative w-[280px] bg-white dark:bg-slate-900 rounded-[24px] border-[6px] transition-all shadow-xl",
                selected ? "border-emerald-600 ring-4 ring-emerald-500/20" : "border-emerald-100 dark:border-slate-800"
            )}>
                <div className="p-4">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-none">{tNodes("orderInfo")}</h4>
                            <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-wider">Shopify Data</p>
                        </div>
                    </div>

                    <div className="space-y-2 bg-emerald-50/50 dark:bg-emerald-500/5 p-3 rounded-xl border border-emerald-100/50 dark:border-emerald-500/10">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-500">Retrieves:</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">Order Details</span>
                        </div>
                        <div className="h-px bg-emerald-100 dark:bg-emerald-500/10 w-full" />
                        <div className="flex flex-wrap gap-1">
                            {['number', 'total', 'items', 'status'].map(field => (
                                <span key={field} className="px-1.5 py-0.5 bg-white dark:bg-slate-800 rounded text-[9px] font-bold text-gray-400 border border-gray-100 dark:border-slate-700">
                                    {field}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <Handle
                    type="target"
                    position={Position.Left}
                    className="w-3! h-3! border-[3px]! border-emerald-600! bg-white! rounded-full!"
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    className="w-3! h-3! border-[3px]! border-emerald-600! bg-white! rounded-full!"
                />
            </div>
        </div>
    );
});

OrderInfoNode.displayName = 'OrderInfoNode';
