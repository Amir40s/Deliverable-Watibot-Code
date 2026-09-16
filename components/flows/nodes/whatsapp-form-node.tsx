import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { MessageSquare, LayoutList, Copy, Trash2, Plus, Eye, DollarSign, Clock, MessageSquareText, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';

export const WhatsappFormNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
    const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
    const [headerText, setHeaderText] = useState(data.header || '');
    const [bodyText, setBodyText] = useState(data.body || '');
    const [footerText, setFooterText] = useState(data.footer || '');
    const [validationMessage, setValidationMessage] = useState(data.validationMessage || '');
    const [timeoutEnabled, setTimeoutEnabled] = useState(data.timeoutEnabled || false);
    const [flowId, setFlowId] = useState(data.flowId || '');
    const [flowToken, setFlowToken] = useState(data.flowToken || '');
    const [screenName, setScreenName] = useState(data.screenName || '');
    const [status, setStatus] = useState(data.status || 'published');
    const [action, setAction] = useState(data.action || 'navigate');
    const [attribute, setAttribute] = useState(data.attribute || '');
    const [buttonTitle, setButtonTitle] = useState(data.buttonTitle || '');
    const [delay, setDelay] = useState(data.delay || '');
    const [timeout, setTimeout] = useState(data.timeout || '');

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
                selected ? "border-cyan-500 shadow-cyan-500/10 ring-4 ring-cyan-500/10" : 
                data.isHoveredDuringConnect ? "border-cyan-400 animate-pulse" :
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
                    <div className="w-1.5 h-16 bg-cyan-500" />
                    <div className="flex items-center gap-4 px-6 py-4">
                        <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 flex items-center justify-center">
                            <MessageSquareText className="w-6 h-6 text-cyan-500" />
                        </div>
                        <span className="font-bold text-xl text-cyan-600 dark:text-cyan-400 tracking-tight">{tNodes("whatsAppForms")}</span>
                    </div>
                    {/* Source Handle in header */}
                    <Handle
                        type="source"
                        position={Position.Right}
                        id="header"
                        className="w-5! h-5! border-[3px]! border-white! bg-cyan-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50! cursor-crosshair! shadow-lg"
                        style={{ pointerEvents: 'all' }}
                    />
                </div>

                {/* Content Container */}
                <div className="p-6 space-y-6">
                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-5">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block mb-2">Flow Metadata</label>
                        
                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Flow ID</span>
                            <Input 
                                placeholder="Type id..." 
                                value={flowId}
                                onChange={(e) => {
                                    setFlowId(e.target.value);
                                    updateNodeData({ flowId: e.target.value });
                                }}
                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-cyan-500/20 shadow-sm px-4"
                            />
                        </div>

                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Flow Token</span>
                            <Input 
                                placeholder="Type token..." 
                                value={flowToken}
                                onChange={(e) => {
                                    setFlowToken(e.target.value);
                                    updateNodeData({ flowToken: e.target.value });
                                }}
                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-cyan-500/20 shadow-sm px-4"
                            />
                        </div>

                        <div className="space-y-2">
                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Initial Screen</span>
                            <Input 
                                placeholder="Screen Name..." 
                                value={screenName}
                                onChange={(e) => {
                                    setScreenName(e.target.value);
                                    updateNodeData({ screenName: e.target.value });
                                }}
                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-cyan-500/20 shadow-sm px-4"
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-5">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block mb-2">Display Content</label>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Header Text</span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{headerText.length}/20</span>
                            </div>
                            <Input 
                                placeholder="Optional header..." 
                                value={headerText}
                                onChange={(e) => setHeaderText(e.target.value)}
                                onBlur={() => updateNodeData({ header: headerText })}
                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-cyan-500/20 shadow-sm px-4" 
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Body Message</span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{bodyText.length}/1024</span>
                            </div>
                            <Textarea 
                                placeholder="Form description..." 
                                value={bodyText}
                                onChange={(e) => setBodyText(e.target.value)}
                                onBlur={() => updateNodeData({ body: bodyText })}
                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 min-h-[100px] text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-cyan-500/20 resize-none px-4 py-3 shadow-sm leading-relaxed" 
                            />
                        </div>

                        <div className="space-y-2 pt-2">
                            <Input 
                                placeholder="Button Title (e.g. Open Form)" 
                                value={buttonTitle}
                                onChange={(e) => {
                                    setButtonTitle(e.target.value);
                                    updateNodeData({ buttonTitle: e.target.value });
                                }}
                                className="bg-cyan-600 border-none h-12 text-white font-bold rounded-2xl focus-visible:ring-cyan-500/20 text-center shadow-lg shadow-cyan-600/20 placeholder:text-cyan-100/50 uppercase tracking-[0.15em] text-xs" 
                            />
                        </div>
                    </div>

                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-6">
                        <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">{tCommon("executionSettings")}</label>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">{tCommon("responseDelay")}</span>
                                <Input 
                                    placeholder="e.g. 1.5" 
                                    value={delay}
                                    onChange={(e) => {
                                        setDelay(e.target.value);
                                        updateNodeData({ delay: e.target.value });
                                    }}
                                    className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-cyan-500/20 shadow-sm px-4"
                                />
                            </div>

                            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{tCommon("enableTimeout")}</span>
                                <Switch 
                                    checked={timeoutEnabled}
                                    onCheckedChange={(checked) => {
                                        setTimeoutEnabled(checked);
                                        updateNodeData({ timeoutEnabled: checked });
                                    }}
                                    className="data-[state=checked]:bg-cyan-600" 
                                />
                            </div>

                            {timeoutEnabled && (
                                <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="space-y-2">
                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Timeout Duration (min)</span>
                                        <div className="relative">
                                            <Input 
                                                placeholder="1 to 72" 
                                                value={timeout}
                                                onChange={(e) => {
                                                    setTimeout(e.target.value);
                                                    updateNodeData({ timeout: e.target.value });
                                                }}
                                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-cyan-500/20 pr-16 shadow-sm px-4"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Minutes</span>
                                        </div>
                                    </div>

                                    <div className="relative group/timeout cursor-crosshair mt-4">
                                        <div className="bg-slate-100/50 dark:bg-slate-900/50 border border-dashed border-cyan-500/30 rounded-2xl h-12 flex items-center justify-center group-hover/timeout:border-cyan-500 transition-all">
                                            <span className="text-cyan-600 dark:text-cyan-400 text-[10px] font-bold uppercase tracking-widest">After Timeout</span>
                                        </div>
                                        <Handle
                                            type="source"
                                            position={Position.Right}
                                            id="timeout"
                                            className="w-5! h-5! border-[3px]! border-white! bg-cyan-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50! cursor-crosshair! shadow-lg"
                                            style={{ pointerEvents: 'all' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="relative group/connect cursor-crosshair">
                        <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl h-14 flex items-center justify-center group-hover/connect:border-cyan-400 transition-all">
                            <span className="text-slate-400 text-xs font-bold uppercase tracking-widest group-hover/connect:text-cyan-500 transition-colors">{tCommon("connectNode")}</span>
                        </div>
                        <Handle
                            type="source"
                            position={Position.Right}
                            id="right"
                            className="w-5! h-5! border-[3px]! border-white! bg-cyan-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50! cursor-crosshair! shadow-lg"
                            style={{ pointerEvents: 'all' }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

WhatsappFormNode.displayName = 'WhatsappFormNode';
