import { memo } from'react';
import { Handle, Position, NodeProps, useReactFlow } from'reactflow';
import { toast } from'sonner';
import { MessageSquareText, Copy, Trash2 } from'lucide-react';
import { Input } from'@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from'@/components/ui/select';
import { cn } from'@/lib/utils';
import { useTranslations } from 'next-intl';

export const ConversionsApiNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
 const { setNodes, deleteElements, getNode, addNodes } = useReactFlow();
 const savedConversionType = String(data.conversionType || data.eventName || 'Lead').toLowerCase();
 const conversionType = savedConversionType === 'purchase' ? 'Purchase' : 'Lead';
 const currency = String(data.currency || 'USD').toUpperCase();

 const updateNodeData = (newData: Record<string, unknown>) => {
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
 "w-[340px] bg-white dark:bg-slate-900 rounded-[24px] shadow-lg transition-all focus:outline-none",
 selected ? "ring-2 ring-emerald-500/40 shadow-emerald-500/10" : 
  data.isHoveredDuringConnect ? "ring-2 ring-emerald-500 animate-pulse shadow-emerald-500/20" :
  "border border-slate-100 dark:border-slate-800"
 )}>
 {/* Handles */}
 <Handle
 type="target"
 position={Position.Left}
 className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!"
 style={{ pointerEvents:'all' }}
 />

 {/* Header Area */}
 <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px] relative">
 <div className="flex items-center">
 <div className="w-1.5 h-14 bg-[#00B074]" />
 <div className="flex items-center gap-3 px-4">
 <MessageSquareText className="w-5 h-5 text-[#00B074]" />
 <span className="font-bold text-[#00B074] tracking-tight text-[15px]">Meta {tNodes("conversionsAPI")}</span>
 </div>
 </div>
 {/* Source Handle moved to top */}
 <Handle
 type="source"
 position={Position.Right}
 id="right"
 className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
 style={{ pointerEvents:'all' }}
 />
 </div>

 {/* Content Container */}
 <div className="p-4">
 <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4">
 
 {/* Dataset / Pixel ID */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1">Dataset / Pixel ID</label>
 <Input
 value={data.eventSourceId || data.datasetId || data.pixelId || ''}
 onChange={(e) => updateNodeData({ eventSourceId: e.target.value })}
 placeholder="Meta dataset or pixel ID"
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 </div>

 {/* Select Conversion Type */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1">Select Conversion Type</label>
 <Select value={conversionType} onValueChange={(value) => updateNodeData({ conversionType: value })}>
 <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus:ring-[#00B074]/20 transition-all nodrag nopan">
 <SelectValue placeholder="Select type" />
 </SelectTrigger>
 <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
 <SelectItem value="Lead">Lead</SelectItem>
 <SelectItem value="Purchase">Purchase</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Select Currency */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1">Select currency (optional)</label>
 <Select value={currency} onValueChange={(value) => updateNodeData({ currency: value })}>
 <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus:ring-[#00B074]/20 transition-all nodrag nopan">
 <SelectValue placeholder="USD" />
 </SelectTrigger>
 <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[300px]">
 {['USD','PKR','INR','AED','SAR','EUR','GBP','CAD','AUD','FKP','FJD','GMD','GEL','GHS','GIP','GTQ','GNF','GYD','HTG','HNL','HKD','HUF','ISK'].map(curr => (
 <SelectItem key={curr} value={curr}>{curr}</SelectItem>
 ))}
 </SelectContent>
 </Select>
 </div>

 {/* Enter Amount */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1">Enter Amount (optional)</label>
 <Input 
 placeholder="Type amount..." 
 value={data.amount || ''}
 onChange={(e) => updateNodeData({ amount: e.target.value })}
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 </div>

 {/* Test Event Code */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1">Test event code (optional)</label>
 <Input
 value={data.testEventCode || ''}
 onChange={(e) => updateNodeData({ testEventCode: e.target.value })}
 placeholder="TEST12345"
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 </div>
 </div>
 </div>


 </div>
 </div>
 );
});

ConversionsApiNode.displayName ='ConversionsApiNode';
