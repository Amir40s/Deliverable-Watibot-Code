import { memo } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { MessageSquareText, Copy, Trash2, ChevronUp, Plus, GitBranch, MousePointerClick, Image as ImageIcon, List } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTranslations } from 'next-intl';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
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
                "w-[340px] bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border-2 border-transparent transition-all overflow-hidden focus:outline-none",
                selected ? "border-amber-500 shadow-amber-500/10 ring-4 ring-amber-500/10" : 
                data.isHoveredDuringConnect ? "border-amber-400 animate-pulse" :
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
                    <div className="w-1.5 h-16 bg-amber-500" />
                    <div className="flex items-center gap-4 px-6 py-4">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                            <GitBranch className="w-6 h-6 text-amber-500" />
                        </div>
                        <span className="font-bold text-xl text-amber-600 dark:text-amber-400 tracking-tight">{tNodes("condition")}</span>
                    </div>
                </div>

                {/* Content Container */}
                <div className="p-6 space-y-6">
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-5 nodrag nopan">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">Logic Rules</label>
                        
                        {/* Select Condition */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Operator</span>
                            <Select>
                                <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus:ring-amber-500/20 px-4 transition-all">
                                    <SelectValue placeholder="Select condition" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-none rounded-2xl shadow-2xl">
                                    <SelectItem value="equal">Equal to</SelectItem>
                                    <SelectItem value="exists">Is present</SelectItem>
                                    <SelectItem value="time_in">Time within range</SelectItem>
                                    <SelectItem value="date_in">Date within range</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Select Attribute */}
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Variable</span>
                            <Select>
                                <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus:ring-amber-500/20 px-4 transition-all">
                                    <div className="flex items-center gap-2">
                                        <span className="text-slate-400 font-bold">$</span>
                                        <SelectValue placeholder="Select attribute" />
                                    </div>
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-slate-900 border-none rounded-2xl shadow-2xl">
                                    <SelectItem value="name">Name</SelectItem>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="phone">Phone</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* True Path */}
                        <div className="relative group/true cursor-crosshair animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-2xl h-14 flex items-center px-6 hover:bg-emerald-500/20 transition-all">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mr-4 animate-pulse" />
                                <span className="text-emerald-600 dark:text-emerald-400 text-sm font-bold uppercase tracking-widest">True Branch</span>
                            </div>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="true"
                                className="w-5! h-5! border-[3px]! border-white! bg-emerald-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50 transition-all hover:scale-125 cursor-crosshair shadow-lg"
                                style={{ pointerEvents: 'all' }}
                            />
                            {/* Floating Plus Button */}
                            <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover/true:opacity-100 transition-all z-50">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" side="right" sideOffset={15} className="w-[220px] p-2 rounded-2xl shadow-2xl border-none bg-white dark:bg-slate-900">
                                        <div className="px-3 py-2 border-b border-slate-50 dark:border-slate-800 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">If True, Do:</span>
                                        </div>
                                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'message', 'true')} className="flex items-center p-2.5 rounded-xl cursor-pointer hover:bg-emerald-50">
                                            <MousePointerClick className="w-4 h-4 mr-3 text-emerald-600" />
                                            <span className="text-[13px] font-bold text-slate-700">{tCommon("interactive")}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'media', 'true')} className="flex items-center p-2.5 rounded-xl cursor-pointer hover:bg-emerald-50">
                                            <ImageIcon className="w-4 h-4 mr-3 text-emerald-600" />
                                            <span className="text-[13px] font-bold text-slate-700">{tCommon("media")}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'list', 'true')} className="flex items-center p-2.5 rounded-xl cursor-pointer hover:bg-emerald-50">
                                            <List className="w-4 h-4 mr-3 text-emerald-600" />
                                            <span className="text-[13px] font-bold text-slate-700">{tNodes("listMessage")}</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* False Path */}
                        <div className="relative group/false cursor-crosshair animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="bg-rose-500/10 border-2 border-rose-500/20 rounded-2xl h-14 flex items-center px-6 hover:bg-rose-500/20 transition-all">
                                <div className="w-2 h-2 rounded-full bg-rose-500 mr-4" />
                                <span className="text-rose-600 dark:text-rose-400 text-sm font-bold uppercase tracking-widest">False Branch</span>
                            </div>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="false"
                                className="w-5! h-5! border-[3px]! border-white! bg-rose-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50 transition-all hover:scale-125 cursor-crosshair shadow-lg"
                                style={{ pointerEvents: 'all' }}
                            />
                            {/* Floating Plus Button */}
                            <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover/false:opacity-100 transition-all z-50">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button className="w-8 h-8 bg-rose-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all">
                                            <Plus className="w-5 h-5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" side="right" sideOffset={15} className="w-[220px] p-2 rounded-2xl shadow-2xl border-none bg-white dark:bg-slate-900">
                                        <div className="px-3 py-2 border-b border-slate-50 dark:border-slate-800 mb-1">
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">If False, Do:</span>
                                        </div>
                                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'message', 'false')} className="flex items-center p-2.5 rounded-xl cursor-pointer hover:bg-rose-50">
                                            <MousePointerClick className="w-4 h-4 mr-3 text-rose-600" />
                                            <span className="text-[13px] font-bold text-slate-700">{tCommon("interactive")}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'media', 'false')} className="flex items-center p-2.5 rounded-xl cursor-pointer hover:bg-rose-50">
                                            <ImageIcon className="w-4 h-4 mr-3 text-rose-600" />
                                            <span className="text-[13px] font-bold text-slate-700">{tCommon("media")}</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'list', 'false')} className="flex items-center p-2.5 rounded-xl cursor-pointer hover:bg-rose-50">
                                            <List className="w-4 h-4 mr-3 text-rose-600" />
                                            <span className="text-[13px] font-bold text-slate-700">{tNodes("listMessage")}</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

ConditionNode.displayName = 'ConditionNode';
