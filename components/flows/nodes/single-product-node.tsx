import { memo, useState } from'react';
import { Handle, Position, NodeProps, useReactFlow } from'reactflow';
import { useTranslations } from 'next-intl';
import {
 Zap, User, ChevronUp, Copy, Trash2, Plus, X, MousePointerClick, Image as ImageIcon, List, ShoppingCart, ShoppingBag
} from'lucide-react';
import { Input } from'@/components/ui/input';
import { Switch } from'@/components/ui/switch';
import { Button } from'@/components/ui/button';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from'@/lib/utils';
import { toast } from'sonner';
import { ProductSelectionModal } from'@/components/flows/modals/product-selection-modal';

export const SingleProductNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
 const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
 const [isProductModalOpen, setIsProductModalOpen] = useState(false);

 // State
 const [header, setHeader] = useState(data.header ||'');
 const [body, setBody] = useState(data.body ||'');
 const [footer, setFooter] = useState(data.footer ||'');
 const [delay, setDelay] = useState(data.delay ||'');
 const [timeoutEnabled, setTimeoutEnabled] = useState(data.timeoutEnabled || false);
 const [timeoutValue, setTimeoutValue] = useState(data.timeoutValue || 24);
 const [selectedProduct, setSelectedProduct] = useState(data.product || null);

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
 "w-[340px] bg-white dark:bg-slate-900 rounded-3xl shadow-xl border-2 border-transparent transition-all",
 selected ? "border-[#00B074] shadow-[#00B074]/10 ring-4 ring-[#00B074]/10" : 
data.isHoveredDuringConnect ? "border-[#00B074] ring-4 ring-[#00B074] animate-pulse shadow-[#00B074]/20" :
"border-slate-100 dark:border-slate-800"
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
 <ShoppingCart className="w-5 h-5 text-[#00B074]" />
 <span className="font-bold text-[#00B074] tracking-tight">{tNodes("singleProduct")}</span>
 </div>
 </div>
 </div>

 {/* Content Container */}
 <div className="p-4 space-y-4">
 <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4">
 {/* Add Product Placeholder */}
 <div
 onClick={(e) => {
 e.stopPropagation();
 setIsProductModalOpen(true);
 }}
 onPointerDown={(e) => e.stopPropagation()}
 className="bg-white dark:bg-slate-900 rounded-2xl h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group/product nodrag nopan"
 >
 {selectedProduct ? (
 <div className="flex flex-col items-center p-2 text-center">
 <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center mb-2">
 <ShoppingCart className="w-6 h-6 text-emerald-600" />
 </div>
 <span className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate w-full px-2">{selectedProduct.name}</span>
 <span className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedProduct.retailer_id}</span>
 </div>
 ) : (
 <>
 <div className="w-10 h-10 rounded-full bg-[#00B074]/10 dark:bg-[#00B074]/20 flex items-center justify-center mb-2 group-hover/product:scale-110 transition-transform">
 <ShoppingCart className="w-5 h-5 text-[#00B074]" />
 </div>
 <span className="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wide uppercase">+ Select Product</span>
 </>
 )}
 </div>

 {/* Body/Footer Inputs */}
 <div className="space-y-1.5">
 <div className="flex justify-between items-center px-1">
 <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Body Text</label>
 <span className="text-[10px] font-mono text-slate-400">{body.length}/1024</span>
 </div>
 <Input
 placeholder="Type your message..."
 value={body}
 onChange={(e) => {
 setBody(e.target.value);
 updateNodeData({ body: e.target.value });
 }}
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 </div>

 <div className="space-y-1.5">
 <div className="flex justify-between items-center px-1">
 <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Footer (Optional)</label>
 <span className="text-[10px] font-mono text-slate-400">{footer.length}/60</span>
 </div>
 <Input
 placeholder="Enter footer text"
 value={footer}
 onChange={(e) => {
 setFooter(e.target.value);
 updateNodeData({ footer: e.target.value });
 }}
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 </div>
 </div>

 {/* Configuration Options */}
 <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4 nodrag nopan">
 <div className="space-y-1.5">
 <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 px-1">Set Delay (Seconds)</label>
 <Input
 placeholder="e.g. 1.5"
 value={delay}
 onChange={(e) => {
 setDelay(e.target.value);
 updateNodeData({ delay: e.target.value });
 }}
 className="bg-white dark:bg-slate-900 border-none h-10 rounded-xl text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-slate-300 px-4"
 />
 </div>

 <div className="flex justify-between items-center px-1">
 <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Resend Timeout</label>
 <Switch
 checked={timeoutEnabled}
 onCheckedChange={(checked) => {
 setTimeoutEnabled(checked);
 updateNodeData({ timeoutEnabled: checked });
 }}
 className="data-[state=checked]:bg-[#00B074]"
 />
 </div>
 </div>

 <DropdownMenu>
 <DropdownMenuTrigger asChild>
 <Button
 variant="outline"
 className="w-full bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 justify-center h-11 rounded-xl shadow-sm font-bold text-[10px] uppercase tracking-widest transition-all nodrag nopan"
 onClick={(e) => e.stopPropagation()}
 >
 + Add Content
 </Button>
 </DropdownMenuTrigger>
 <DropdownMenuContent align="end" side="right" sideOffset={10} className="w-[260px] p-2 rounded-2xl shadow-xl border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
 <div className="flex items-center justify-between px-2 py-2 mb-1">
 <span className="text-[15px] font-medium text-slate-900 dark:text-slate-100">Content Block</span>
 <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
 <X className="w-5 h-5" />
 </button>
 </div>
 <div className="space-y-0.5">
 <DropdownMenuItem
 onClick={() => data.onAddNodeAndConnect?.(id,'message')}
 className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
 >
 <div className="w-8 h-8 bg-[#00B074]/10 dark:bg-[#00B074]/20 rounded-lg flex items-center justify-center mr-3 shrink-0">
 <MousePointerClick className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
 </div>
 <span className="text-[14px] text-slate-700 dark:text-slate-200">Text + Button</span>
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => data.onAddNodeAndConnect?.(id,'media')}
 className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
 >
 <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
 <ImageIcon className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
 </div>
 <span className="text-[14px] text-slate-700 dark:text-slate-200">{tCommon("media")}</span>
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => data.onAddNodeAndConnect?.(id,'list')}
 className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
 >
 <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
 <List className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
 </div>
 <span className="text-[14px] text-slate-700 dark:text-slate-200">{tNodes("listMessage")}</span>
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => data.onAddNodeAndConnect?.(id,'single_product')}
 className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
 >
 <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
 <ShoppingCart className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
 </div>
 <span className="text-[14px] text-slate-700 dark:text-slate-200">Single Product Message</span>
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => data.onAddNodeAndConnect?.(id,'multi_product')}
 className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
 >
 <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
 <ShoppingBag className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
 </div>
 <span className="text-[14px] text-slate-700 dark:text-slate-200">Multi Product Message</span>
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => data.onAddNodeAndConnect?.(id,'template')}
 className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
 >
 <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
 <Zap className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
 </div>
 <span className="text-[14px] text-slate-700 dark:text-slate-200">Template</span>
 </DropdownMenuItem>
 <DropdownMenuItem
 onClick={() => data.onAddNodeAndConnect?.(id,'request_intervention')}
 className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
 >
 <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
 <User className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
 </div>
 <span className="text-[14px] text-slate-700 dark:text-slate-200">{tNodes("requestIntervention")}</span>
 </DropdownMenuItem>
 </div>
 </DropdownMenuContent>
 </DropdownMenu>

 {/* Output Handle */}
 <div className="relative group/connect cursor-pointer pt-1">
 <div className="bg-white dark:bg-slate-900 border border-[#00B074]/20 rounded-2xl h-[44px] flex items-center justify-center group-hover/connect:bg-[#00B074]/5 transition-all shadow-sm nodrag nopan">
 <span className="text-[#00B074] dark:text-[#00B074] text-[15px] font-medium tracking-tight pr-4">Connect Component</span>
 <Handle
 type="source"
 position={Position.Right}
 id="right"
 className="w-4! h-4! border-[3px]! border-[#00B074]! bg-[#F0F3F1]! dark:bg-slate-800! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
 style={{ pointerEvents:'all' }}
 />
 </div>
 </div>
 </div>

 </div>

 <ProductSelectionModal
 isOpen={isProductModalOpen}
 onClose={() => setIsProductModalOpen(false)}
 onSelect={(product) => {
 setSelectedProduct(product);
 updateNodeData({ product });
 setIsProductModalOpen(false);
 }}
 />
 </div>
 );
});

SingleProductNode.displayName ='SingleProductNode';
