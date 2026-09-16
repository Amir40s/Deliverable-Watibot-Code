import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { ShoppingCart, Copy, Trash2, Plus, Eye, List, ChevronUp, MousePointerClick, Image as ImageIcon, X, ShoppingBag, Zap, User } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useTranslations } from 'next-intl';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CatalogueItem {
    id: string;
    body: string;
    footer: string;
}

export const CatalogueNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
    const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
    const [items, setItems] = useState<CatalogueItem[]>(data.items || [
        { id: '1', body: '', footer: '' }
    ]);
    const [delay, setDelay] = useState(data.delay || '');
    const [timeoutEnabled, setTimeoutEnabled] = useState(data.timeoutEnabled || false);
    const [timeoutValue, setTimeoutValue] = useState(data.timeoutValue || 24);

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

    const handleAddSection = () => {
        const newItems = [...items, { id: Math.random().toString(36).substr(2, 9), body: '', footer: '' }];
        setItems(newItems);
        updateNodeData({ items: newItems });
    };

    const handleUpdateItem = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
        updateNodeData({ items: newItems });
    };

    const handleRemoveItem = (itemId: string) => {
        const newItems = items.filter(i => i.id !== itemId);
        setItems(newItems);
        updateNodeData({ items: newItems });
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
                "w-[340px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border-2 border-transparent transition-all overflow-hidden focus:outline-none",
                selected ? "border-emerald-500 shadow-emerald-500/10 ring-4 ring-emerald-500/10" : 
                data.isHoveredDuringConnect ? "border-emerald-400 animate-pulse" :
                "border-slate-100 dark:border-slate-800"
            )}>
                {/* Handles */}
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
                            <ShoppingCart className="w-6 h-6 text-emerald-500" />
                        </div>
                        <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400 tracking-tight">{tNodes("catalogue")}</span>
                    </div>
                </div>

                {/* Content Container */}
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={item.id} className="group/section relative bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-4 hover:border-emerald-400/50 transition-all animate-in fade-in slide-in-from-top-2 nodrag nopan">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">Section {index + 1}</span>
                                    {items.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Body Input */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Body Text</span>
                                        <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{item.body.length}/1024</span>
                                    </div>
                                    <Input
                                        placeholder="Section body..."
                                        value={item.body}
                                        onChange={(e) => handleUpdateItem(index, 'body', e.target.value)}
                                        className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus-visible:ring-emerald-500/20 px-4"
                                    />
                                </div>

                                {/* Footer Input */}
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center px-1">
                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Footer Text</span>
                                        <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{item.footer.length}/60</span>
                                    </div>
                                    <Input
                                        placeholder="Section footer..."
                                        value={item.footer}
                                        onChange={(e) => handleUpdateItem(index, 'footer', e.target.value)}
                                        className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus-visible:ring-emerald-500/20 px-4"
                                    />
                                </div>

                                {/* Section Handle */}
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={item.id}
                                    className="w-5! h-5! border-[3px]! border-white! bg-emerald-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50 transition-all hover:scale-125 cursor-crosshair shadow-lg"
                                />

                                {/* Floating Plus Button for connecting from section */}
                                <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover/section:opacity-100 transition-all z-50">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <button className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all">
                                                <Plus className="w-5 h-5" />
                                            </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" side="right" sideOffset={15} className="w-[220px] p-2 rounded-2xl shadow-2xl border-none bg-white dark:bg-slate-900">
                                            <div className="px-3 py-2 border-b border-slate-50 dark:border-slate-800 mb-1">
                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Add Next Step</span>
                                            </div>
                                            <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'message', item.id)} className="flex items-center p-2.5 rounded-xl cursor-pointer hover:bg-emerald-50">
                                                <MousePointerClick className="w-4 h-4 mr-3 text-emerald-600" />
                                                <span className="text-[13px] font-bold text-slate-700">{tCommon("interactive")}</span>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'media', item.id)} className="flex items-center p-2.5 rounded-xl cursor-pointer hover:bg-emerald-50">
                                                <ImageIcon className="w-4 h-4 mr-3 text-emerald-600" />
                                                <span className="text-[13px] font-bold text-slate-700">{tCommon("media")}</span>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4">
                        <Button
                            variant="outline"
                            onClick={handleAddSection}
                            className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 justify-center h-12 rounded-2xl shadow-sm text-xs font-bold uppercase tracking-widest transition-all hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 nodrag nopan"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Section
                        </Button>

                        {/* Add Content Button */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full bg-emerald-600 text-white border-none justify-center h-12 rounded-2xl shadow-lg shadow-emerald-600/20 text-xs font-bold uppercase tracking-[0.2em] transition-all hover:bg-emerald-700 hover:scale-[1.02] active:scale-95 nodrag nopan"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    + Add Content
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="center" side="bottom" sideOffset={10} className="w-[280px] p-3 rounded-[24px] shadow-2xl border-none bg-white dark:bg-slate-900">
                                <div className="px-3 py-3 mb-2 border-b border-slate-50 dark:border-slate-800">
                                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{tCommon("availableBlocks")}</span>
                                </div>
                                <div className="grid grid-cols-1 gap-1">
                                    <DropdownMenuItem
                                        onClick={() => data.onAddNodeAndConnect?.(id, 'message')}
                                        className="p-2.5 cursor-pointer rounded-xl hover:bg-blue-50 dark:hover:bg-blue-900/20 focus:bg-blue-50 dark:focus:bg-blue-900/20 flex items-center group/item"
                                    >
                                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center mr-4 shrink-0 transition-transform group-hover/item:scale-110">
                                            <MousePointerClick className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-slate-200">{tCommon("interactive")}</span>
                                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{tCommon("textButtons")}</span>
                                        </div>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => data.onAddNodeAndConnect?.(id, 'media')}
                                        className="p-2.5 cursor-pointer rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-900/20 focus:bg-emerald-50 dark:focus:bg-emerald-900/20 flex items-center group/item"
                                    >
                                        <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center mr-4 shrink-0 transition-transform group-hover/item:scale-110">
                                            <ImageIcon className="w-5 h-5 text-emerald-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-slate-200">{tCommon("media")}</span>
                                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{tCommon("imageVideoAudio")}</span>
                                        </div>
                                    </DropdownMenuItem>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Execution Settings */}
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-6 nodrag nopan">
                        <div className="space-y-3">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">{tCommon("executionSettings")}</label>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">{tCommon("responseDelay")}</span>
                                    <Input
                                        placeholder="e.g. 1.0"
                                        value={delay}
                                        onChange={(e) => {
                                            setDelay(e.target.value);
                                            updateNodeData({ delay: e.target.value });
                                        }}
                                        className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus:ring-emerald-500/20 px-4"
                                    />
                                </div>

                                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Resend Timeout</span>
                                    <Switch
                                        checked={timeoutEnabled}
                                        onCheckedChange={(checked) => {
                                            setTimeoutEnabled(checked);
                                            updateNodeData({ timeoutEnabled: checked });
                                        }}
                                        className="data-[state=checked]:bg-emerald-600"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="relative group/connect cursor-crosshair">
                        <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl h-14 flex items-center justify-center group-hover/connect:border-emerald-400 transition-all">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest group-hover/connect:text-emerald-500 transition-colors">{tCommon("connectNode")}</span>
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

CatalogueNode.displayName = 'CatalogueNode';
