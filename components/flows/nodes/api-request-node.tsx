import { memo, useState } from'react';
import { Handle, Position, NodeProps, useReactFlow } from'reactflow';
import { toast } from'sonner';
import { MessageSquareText, Copy, Trash2, X, Pencil } from'lucide-react';
import { Input } from'@/components/ui/input';
import { cn } from'@/lib/utils';
import { ApiRequestModal } from'@/components/flows/modals/api-request-modal';
import { useTranslations } from 'next-intl';

interface StatusCodeEntry {
 id: string;
 value: string;
}

export const ApiRequestNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
 const { deleteElements, getNode, addNodes } = useReactFlow();
 const [customCodes, setCustomCodes] = useState<StatusCodeEntry[]>([]);
 const [modalOpen, setModalOpen] = useState(false);

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
 id:`${node.type}-${Date.now()}`,
 position: { x: node.position.x + 50, y: node.position.y + 50 },
 });
 toast.success(tCommon("nodeDuplicated"));
 };

 const addCustomCode = () => {
 setCustomCodes(prev => [...prev, { id: crypto.randomUUID(), value:'' }]);
 };

 const removeCustomCode = (codeId: string) => {
 setCustomCodes(prev => prev.filter(c => c.id !== codeId));
 };

 return (
 <div className="relative group/node">
 {/* Modal */}
 <ApiRequestModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />

 {/* Top Menu (Horizontal) - Node-level actions */}
 {selected && (
 <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-1.5 z-20 animate-in fade-in zoom-in slide-in-from-bottom-2 nodrag nopan">
 <button
 onClick={(e) => { e.stopPropagation(); handleCopy(); }}
 className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-300 transition-colors"
 >
 <Copy className="w-5 h-5" />
 </button>
 <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
 <button
 onClick={(e) => { e.stopPropagation(); handleDelete(); }}
 className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors"
 >
 <Trash2 className="w-5 h-5" />
 </button>
 </div>
 )}


 <div className={cn(
 "w-[340px] bg-white dark:bg-slate-900 rounded-[24px] shadow-lg transition-all focus:outline-none",
 selected ? "ring-2 ring-emerald-500/40 shadow-emerald-500/10" : "border border-slate-100 dark:border-slate-800"
 )}>
 {/* Target Handle */}
 <Handle
 type="target"
 position={Position.Left}
 className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!"
 style={{ pointerEvents:'all' }}
 />

 {/* Header */}
 <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px] relative pr-10">
 <div className="flex items-center">
 <div className="w-1.5 h-14 bg-[#00B074]" />
 <div className="flex items-center gap-3 px-4">
 <MessageSquareText className="w-5 h-5 text-[#00B074]" />
 <span className="font-bold text-[#00B074] tracking-tight text-[15px]">{tNodes("aPIRequest")}</span>
 </div>
 </div>

 {/* Clean edit button inside header */}
 <button
   type="button"
   onClick={(e) => { e.stopPropagation(); setModalOpen(true); }}
   className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-850 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors nodrag nopan shrink-0"
   title="Configure API Webhook"
 >
   <Pencil className="w-3.5 h-3.5" />
 </button>

 {/* Source Handle in header */}
 <Handle
 type="source"
 position={Position.Right}
 id="right"
 className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
 style={{ pointerEvents:'all' }}
 />
 </div>

 {/* Content */}
 <div className="p-4 space-y-4">
 <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-3">

 {/* API Request Url label */}
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">API Request Url</label>

 {/* Webhook URL input */}
 <Input
 placeholder="Webhook URL"
 defaultValue={data.url}
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />

 {/* Custom Status Code entries */}
 {customCodes.map((code) => (
 <div key={code.id} className="relative animate-in fade-in slide-in-from-top-1 duration-200">
 <div className="relative bg-white dark:bg-slate-900 rounded-xl shadow-sm">
 <button
 onClick={() => removeCustomCode(code.id)}
 className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors nodrag nopan"
 >
 <X className="w-4 h-4" strokeWidth={2.5} />
 </button>
 <Input
 placeholder="Status code (e.g. 404)"
 defaultValue={code.value}
 className="border-none h-11 pl-9 pr-10 text-slate-700 dark:text-slate-200 font-medium rounded-xl bg-transparent focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 </div>
 <Handle
 type="source"
 position={Position.Right}
 id={`code-${code.id}`}
 className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
 style={{ pointerEvents:'all' }}
 />
 </div>
 ))}

 {/* Status Fallback button */}
 <div className="relative group/fallback cursor-pointer">
 <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-xl h-11 flex items-center justify-center group-hover/fallback:bg-emerald-50/50 transition-all shadow-sm">
 <span className="text-[#00B074] dark:text-emerald-400 text-sm font-medium">Status Fallback</span>
 </div>
 <Handle
 type="source"
 position={Position.Right}
 id="fallback"
 className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
 style={{ pointerEvents:'all' }}
 />
 </div>

 {/* + Custom Status Code button */}
 <button
 onClick={(e) => {
 e.stopPropagation();
 addCustomCode();
 }}
 className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-11 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm text-slate-700 dark:text-slate-200 text-sm font-medium nodrag nopan"
 >
 + Custom Status Code
 </button>
 </div>
 </div>
 </div>
 </div>
 );
});

ApiRequestNode.displayName ='ApiRequestNode';
