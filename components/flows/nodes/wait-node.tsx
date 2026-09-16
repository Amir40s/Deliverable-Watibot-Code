import { memo } from'react';
import { Handle, Position, NodeProps, useReactFlow } from'reactflow';
import { toast } from'sonner';
import { Keyboard, Copy, Trash2, ChevronUp, Plus } from'lucide-react';
import { cn } from'@/lib/utils';
import { useTranslations } from 'next-intl';

export const WaitNode = memo(({ id, data, selected }: NodeProps) => {
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
 id:`${node.type}-${Date.now()}`,
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
 "w-[240px] bg-white dark:bg-slate-900 rounded-3xl shadow-xl border-2 border-transparent transition-all",
 selected ? "border-[#00B074] shadow-[#00B074]/10 ring-4 ring-[#00B074]/10" : "border-slate-100 dark:border-slate-800"
 )}>
 {/* Handles */}
 <Handle
 type="target"
 position={Position.Left}
 className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!"
 style={{ pointerEvents:'all' }}
 />

 {/* Header */}
 <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px]">
 <div className="flex items-center">
 <div className="w-1.5 h-14 bg-[#00B074]" />
 <div className="flex items-center gap-3 px-4">
 <Keyboard className="w-5 h-5 text-[#00B074]" />
 <span className="font-bold text-[#00B074] tracking-tight">{tNodes("wait")}</span>
 </div>
 </div>
 </div>

 {/* Content Container */}
 <div className="p-4 space-y-3">
 <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-100 dark:border-slate-800 text-center">
 <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">Wait Type</span>
 <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
 {data.label ||'User Response'}
 </p>
 </div>

 {data.variableName && (
 <div className="px-1 flex items-center justify-center gap-2">
 <div className="text-[11px] font-semibold text-slate-500">Save to:</div>
 <div className="px-2 py-0.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono font-bold">
 {data.variableName}
 </div>
 </div>
 )}
 </div>

 <Handle
 type="source"
 position={Position.Right}
 id="right"
 className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
 style={{ pointerEvents:'all' }}
 />
 </div>
 </div>
 );
});

WaitNode.displayName ='WaitNode';
