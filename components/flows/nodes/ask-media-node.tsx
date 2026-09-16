import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { MessageSquareText, Copy, Trash2, ChevronUp, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export const AskMediaNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();

  // State
  const [availableAttributes, setAvailableAttributes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [question, setQuestion] = useState(data.question || '');
  const [attribute, setAttribute] = useState(data.attribute || '');
  const [variableName, setVariableName] = useState(data.variableName || '');

  useEffect(() => {
    getCustomAttributes()
      .then(attrs => {
        setAvailableAttributes(attrs);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);
 const [mediaType, setMediaType] = useState(data.mediaType ||'any');
 const [attempts, setAttempts] = useState(data.attempts ||'1');
 const [errorMessage, setErrorMessage] = useState(data.errorMessage ||'');
 const [delay, setDelay] = useState(data.delay ||'');
 const [timeoutEnabled, setTimeoutEnabled] = useState(data.timeoutEnabled || false);
 const [timeout, setTimeoutValue] = useState(data.timeout ||'');

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
 id:`${node.type}-${Date.now()}`,
 position: { x: node.position.x + 50, y: node.position.y + 50 },
 });
 toast.success(tCommon("nodeDuplicated"));
 };

 return (
 <div className="relative group/node">
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
 selected ? "ring-2 ring-emerald-500/40 shadow-emerald-500/10" : 
  data.isHoveredDuringConnect ? "ring-2 ring-emerald-500 animate-pulse shadow-emerald-500/20" :
  "border border-slate-100 dark:border-slate-800"
 )}>
 {/* Target Handle */}
 <Handle
 type="target"
 position={Position.Left}
 className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!"
 style={{ pointerEvents:'all' }}
 />

 {/* Header */}
 <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px] relative">
 <div className="flex items-center">
 <div className="w-1.5 h-14 bg-[#00B074]" />
 <div className="flex items-center gap-3 px-4">
 <MessageSquareText className="w-5 h-5 text-[#00B074]" />
 <span className="font-bold text-[#00B074] tracking-tight text-[15px]">Media Question</span>
 </div>
 </div>
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
 <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4">

 {/* Media Question */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Media Question</label>
 <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm">
 <Textarea
 placeholder="Type question..."
 maxLength={1024}
 value={question}
 onChange={(e) => {
 setQuestion(e.target.value);
 updateNodeData({ question: e.target.value });
 }}
 className="min-h-[80px] border-none shadow-none focus-visible:ring-0 resize-none text-sm bg-transparent text-slate-700 dark:text-slate-200 rounded-xl nodrag nopan"
 />
 <div className="text-[10px] text-slate-400 text-right px-3 pb-2 font-mono">
 {question.length}/1024
 </div>
 </div>
 </div>

 {/* Capture answer attribute */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Capture answer attribute</label>
 <div className="relative">
 <Select
 value={attribute}
 onValueChange={(val) => {
 setAttribute(val);
 updateNodeData({ attribute: val });
 }}
 >
 <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-none h-11 pl-9 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus:ring-[#00B074]/20 transition-all nodrag nopan">
 <SelectValue placeholder="Select attribute" />
 </SelectTrigger>
  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[200px] overflow-y-auto">
    <SelectItem value="attr_media_url">Media URL</SelectItem>
    <SelectItem value="attr_media_type">Media Type</SelectItem>
    {availableAttributes.map(attr => (
      <SelectItem key={attr} value={attr} className="capitalize">
        {attr}
      </SelectItem>
    ))}
    <SelectItem value="attr_custom" className="text-emerald-600 font-bold">
      + Custom Variable
    </SelectItem>
  </SelectContent>
 </Select>
 <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
 <span className="text-sm font-bold">$</span>
 </div>
 </div>
 </div>

 {/* Custom Variable Name Input - Only visible when Custom is selected */}
 {attribute ==='attr_custom' && (
 <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Variable Name</label>
 <Input
 placeholder="e.g. userPhoto"
 value={variableName}
 onChange={(e) => {
 setVariableName(e.target.value);
 updateNodeData({ variableName: e.target.value });
 }}
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 <p className="text-[10px] text-slate-400 px-1">Use this to save the media for later use.</p>
 </div>
 )}

 {/* Media Type */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Media Type</label>
 <Select
 value={mediaType}
 onValueChange={(val) => {
 setMediaType(val);
 updateNodeData({ mediaType: val });
 }}
 >
 <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus:ring-[#00B074]/20 transition-all nodrag nopan">
 <SelectValue placeholder="Any" />
 </SelectTrigger>
 <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
 <SelectItem value="any">Any</SelectItem>
 <SelectItem value="image">Image</SelectItem>
 <SelectItem value="video">Video</SelectItem>
 <SelectItem value="document">Document</SelectItem>
 <SelectItem value="audio">Audio</SelectItem>
 </SelectContent>
 </Select>
 </div>

 {/* Number of attempt */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Number of attempt</label>
 <Input
 value={attempts}
 type="number"
 min="1"
 onChange={(e) => {
 setAttempts(e.target.value);
 updateNodeData({ attempts: e.target.value });
 }}
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 </div>

 {/* Enter Validation error message */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Enter Validation error message</label>
 <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm">
 <Textarea
 placeholder="Type message"
 maxLength={1024}
 value={errorMessage}
 onChange={(e) => {
 setErrorMessage(e.target.value);
 updateNodeData({ errorMessage: e.target.value });
 }}
 className="min-h-[70px] border-none shadow-none focus-visible:ring-0 resize-none text-sm bg-transparent text-slate-700 dark:text-slate-200 rounded-xl nodrag nopan"
 />
 <div className="text-[10px] text-slate-400 text-right px-3 pb-2 font-mono">
 {errorMessage.length}/1024
 </div>
 </div>
 </div>

 {/* Set Delay */}
 <div className="space-y-1.5">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Set Delay</label>
 <Input
 placeholder="Type delay in seconds..."
 value={delay}
 onChange={(e) => {
 setDelay(e.target.value);
 updateNodeData({ delay: e.target.value });
 }}
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
 />
 </div>

 {/* Set Timeout Toggle */}
 <div className="flex items-center justify-between px-1">
 <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 tracking-tight">Set Timeout</label>
 <Switch
 checked={timeoutEnabled}
 onCheckedChange={(checked) => {
 setTimeoutEnabled(checked);
 updateNodeData({ timeoutEnabled: checked });
 }}
 className="data-[state=checked]:bg-[#00B074]"
 />
 </div>

 {/* Conditional Timeout Input */}
 {timeoutEnabled && (
 <div className="space-y-1 relative animate-in fade-in slide-in-from-top-1 duration-200">
 <Input
 placeholder="Enter in minutes"
 value={timeout}
 onChange={(e) => {
 setTimeoutValue(e.target.value);
 updateNodeData({ timeout: e.target.value });
 }}
 className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 pr-16 nodrag nopan"
 />
 <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-medium">1 to 72</span>
 </div>
 )}

 {/* After Timeout button - conditional */}
 {timeoutEnabled && (
 <div className="relative group/timeout cursor-pointer animate-in fade-in slide-in-from-top-1 duration-200">
 <div className="bg-white dark:bg-slate-900 border border-emerald-500/30 rounded-xl h-11 flex items-center justify-center group-hover/timeout:bg-emerald-50/50 transition-all shadow-sm">
 <span className="text-[#00B074] dark:text-emerald-400 text-sm font-medium">After Timeout</span>
 </div>
 <Handle
 type="source"
 position={Position.Right}
 id="timeout"
 className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
 style={{ pointerEvents:'all' }}
 />
 </div>
 )}
 </div>

 {/* Connect Component */}
 <div className="relative group/connect cursor-pointer px-1">
 <div className="bg-[#EFECE5] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl h-11 flex items-center justify-center group-hover/connect:bg-white dark:group-hover/connect:bg-slate-700 transition-all shadow-sm">
 <span className="text-[#00B074] dark:text-slate-300 text-sm font-medium">Connect Component</span>
 </div>
 <Handle
 type="source"
 position={Position.Right}
 id="connect"
 className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
 style={{ pointerEvents:'all' }}
 />
 </div>
 </div>
 </div>
 </div>
 );
});

AskMediaNode.displayName ='AskMediaNode';
