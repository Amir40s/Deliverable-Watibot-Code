import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
  MessageSquare, Copy, Trash2, X, MousePointerClick,
  Image as ImageIcon, List, ShoppingCart, ShoppingBag,
  Zap, User, ChevronUp, Plus, Link2, Tag as TagIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { NodePickerPanel } from '@/components/flows/panels/node-picker-panel';
import { getTags, createTag } from '@/app/actions/tags';
import { getAgents } from '@/app/actions/agents';
import { CreateTagModal } from '@/components/flows/modals/create-tag-modal';
import { COMMON_CONTACT_VARIABLES } from '@/lib/messaging/contactVariables';

export const MessageNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState(data.message || '');
  const [delay, setDelay] = useState(data.delay || '');
  const [timeoutEnabled, setTimeoutEnabled] = useState(data.timeoutEnabled || false);
  const [buttons, setButtons] = useState<any[]>(data.buttons || []);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  const fetchTagsAndAgents = useCallback(() => {
    getTags().then(res => setAvailableTags(Array.isArray(res) ? res : [])).catch(console.error);
    getAgents().then(res => setAvailableAgents(Array.isArray(res) ? res : [])).catch(console.error);
  }, []);

  useEffect(() => {
    fetchTagsAndAgents();
  }, [fetchTagsAndAgents]);

  const updateNodeData = (newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const handleAddButton = () => {
    const isInstagram = data.platform?.includes('INSTAGRAM');
    const maxButtons = isInstagram ? 13 : 3;
    if (buttons.length >= maxButtons) {
      toast.error(`Maximum ${maxButtons} buttons allowed`);
      return;
    }
    const newButtons = [...buttons, { id: `btn-${Date.now()}`, text: 'New Button' }];
    setButtons(newButtons);
    updateNodeData({ buttons: newButtons });
  };

  const handleRemoveButton = (btnId: string) => {
    const newButtons = buttons.filter(b => b.id !== btnId);
    setButtons(newButtons);
    updateNodeData({ buttons: newButtons });
  };

  const handleButtonChange = (btnId: string, text: string) => {
    const newButtons = buttons.map(b => b.id === btnId ? { ...b, text } : b);
    setButtons(newButtons);
    updateNodeData({ buttons: newButtons });
  };

  const handleToggleTag = (btnId: string, tagId: string) => {
    const newButtons = buttons.map(b => {
      if (b.id !== btnId) return b;
      const tagIds = b.tagIds || [];
      const newTagIds = tagIds.includes(tagId)
        ? tagIds.filter((id: string) => id !== tagId)
        : [...tagIds, tagId];
      return { ...b, tagIds: newTagIds };
    });
    setButtons(newButtons);
    updateNodeData({ buttons: newButtons });
  };

  const handleToggleAgent = (btnId: string, agentId: string) => {
    const newButtons = buttons.map(b => {
      if (b.id !== btnId) return b;
      const agentIds = b.agentIds || [];
      const newAgentIds = agentIds.includes(agentId)
        ? agentIds.filter((id: string) => id !== agentId)
        : [...agentIds, agentId];
      return { ...b, agentIds: newAgentIds };
    });
    setButtons(newButtons);
    updateNodeData({ buttons: newButtons });
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

  const [activeTagButtonId, setActiveTagButtonId] = useState<string | null>(null);

  const handleCreateTag = async (tagData: { name: string, color: string }) => {
    try {
      const res: any = await createTag(tagData.name, tagData.color, undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      
      const newTag = res.data;
      toast.success(`Tag "${tagData.name}" created`);
      setAvailableTags(prev => [...prev, newTag]);
      
      // Auto-select the tag if we know which button it's for
      if (activeTagButtonId) {
        handleToggleTag(activeTagButtonId, newTag.id);
      }
      setActiveTagButtonId(null);
    } catch (error) {
      toast.error("Failed to create tag");
    }
  };

  const SHOPIFY_VARIABLES = [
    { label: 'Order Number', value: '{{order.number}}' },
    { label: 'Total Price', value: '{{order.total}}' },
    { label: 'Currency', value: '{{order.currency}}' },
    { label: 'Customer First Name', value: '{{customer.firstName}}' },
    { label: 'Customer Last Name', value: '{{customer.lastName}}' },
    { label: 'Customer Email', value: '{{customer.email}}' },
    { label: 'Shop Name', value: '{{shop.name}}' },
  ];

  const availableVariables = [
    ...COMMON_CONTACT_VARIABLES,
    ...(data.platform === 'SHOPIFY' ? SHOPIFY_VARIABLES : []),
  ];

  const insertVariable = (variableValue: string) => {
    const textarea = document.getElementById(`textarea-${id}`) as HTMLTextAreaElement;
    if (!textarea) {
      const newMessage = message + variableValue;
      setMessage(newMessage);
      updateNodeData({ message: newMessage });
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    const newMessage = before + variableValue + after;
    
    setMessage(newMessage);
    updateNodeData({ message: newMessage });
    
    // Reset cursor position after state update (needs a timeout for React to render)
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variableValue.length, start + variableValue.length);
    }, 0);
  };

    return (
        <>
            <CreateTagModal
                isOpen={isTagModalOpen}
                onClose={() => {
                    setIsTagModalOpen(false);
                    setActiveTagButtonId(null);
                }}
                onSubmit={handleCreateTag}
            />
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
                    selected ? "border-blue-500 shadow-blue-500/10 ring-4 ring-blue-500/10" : 
                    data.isHoveredDuringConnect ? "border-blue-400 animate-pulse" :
                    "border-slate-100 dark:border-slate-800"
                )}>
                    {/* Node Picker Panel */}
                    <NodePickerPanel
                        isOpen={pickerOpen}
                        onClose={() => setPickerOpen(false)}
                        onSelect={(type) => {
                            if (data.onAddNodeAndConnect) {
                                data.onAddNodeAndConnect(id, type);
                            }
                        }}
                    />

                    {/* Left Handle */}
                    <Handle
                        type="target"
                        position={Position.Left}
                        className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!"
                        style={{ pointerEvents: 'all' }}
                    />

                    {/* Header Area */}
                    <div className="bg-slate-50/50 dark:bg-slate-800/50 flex items-center border-b border-slate-100 dark:border-slate-800 relative">
                        <div className="w-1.5 h-16 bg-blue-500" />
                        <div className="flex items-center gap-4 px-6 py-4">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                                <MessageSquare className="w-6 h-6 text-blue-500" />
                            </div>
                            <span className="font-bold text-xl text-blue-600 dark:text-blue-400 tracking-tight">{tNodes("message")}</span>
                        </div>
                    </div>

                    {/* Content Container */}
                    <div className="p-6 space-y-6">
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-4">
                            {/* Message Input Container */}
                            <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm nodrag nopan border border-slate-100 dark:border-slate-800 focus-within:border-blue-400 transition-all">
                                <Textarea
                                    id={`textarea-${id}`}
                                    placeholder="Type your message here..."
                                    value={message}
                                    onChange={(e) => {
                                        setMessage(e.target.value);
                                        updateNodeData({ message: e.target.value });
                                    }}
                                    className="border-none shadow-none resize-none px-0 py-0 min-h-[80px] text-[15px] text-slate-700 dark:text-slate-200 bg-transparent focus-visible:ring-0 placeholder:text-slate-400 transition-all font-bold leading-relaxed"
                                />
                                <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-50 dark:border-slate-800">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px] font-bold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 gap-1.5 uppercase tracking-widest rounded-lg">
                                                <Plus className="w-3.5 h-3.5" /> Variables
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start" className="w-64 max-h-72 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl p-2 z-50">
                                            <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contact Variables</div>
                                            {availableVariables.map((v) => (
                                                <DropdownMenuItem 
                                                    key={v.value} 
                                                    onClick={() => insertVariable(v.value)}
                                                    className="text-xs py-2 px-3 rounded-xl cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10 text-slate-700 dark:text-slate-200 flex flex-col items-start"
                                                >
                                                    <span className="font-bold">{v.label}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono mt-0.5">{v.value}</span>
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <div className="text-[11px] text-slate-400 font-mono font-bold tracking-wider">{message.length}/1024</div>
                                </div>
                            </div>

                            {buttons.map((btn, index) => (
                                <div key={btn.id} className="relative space-y-3 group/btn nodrag nopan">
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm focus-within:border-blue-400 transition-all">
                                            <Input
                                                className="border-none h-6 p-0 text-[14px] focus-visible:ring-0 bg-transparent font-bold text-slate-700 dark:text-slate-200 placeholder:font-medium"
                                                value={btn.text}
                                                onChange={(e) => handleButtonChange(btn.id, e.target.value)}
                                                placeholder="Button label..."
                                            />
                                            <button
                                                onClick={() => handleRemoveButton(btn.id)}
                                                className="opacity-0 group-hover/btn:opacity-100 p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-red-500 transition-all"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        {btn.type !== 'link' && (
                                            <Handle
                                                type="source"
                                                position={Position.Right}
                                                id={btn.id}
                                                className={cn(
                                                    "w-5 h-5 border-[3px] border-white bg-blue-500 rounded-full absolute -right-2.5 top-1/2 -translate-y-1/2 z-50 transition-all hover:scale-125 cursor-crosshair shadow-lg",
                                                )}
                                                style={{ pointerEvents: 'all' }}
                                            />
                                        )}
                                    </div>

                                    {/* URL and Tags Fields */}
                                    <div className="flex flex-col gap-3 px-1 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 dark:bg-slate-900/50 rounded-xl">
                                            <button
                                                onClick={() => {
                                                    const newButtons = buttons.map(b =>
                                                        b.id === btn.id ? { ...b, type: 'action', url: '' } : b
                                                    );
                                                    setButtons(newButtons);
                                                    updateNodeData({ buttons: newButtons });
                                                }}
                                                className={cn(
                                                    "flex-1 h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2",
                                                    (btn.type === 'action' || !btn.type) ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "text-slate-500 hover:bg-white dark:hover:bg-slate-700"
                                                )}
                                            >
                                                <Zap className="w-3.5 h-3.5" />
                                                Action
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const newButtons = buttons.map(b =>
                                                        b.id === btn.id ? { ...b, type: 'link' } : b
                                                    );
                                                    setButtons(newButtons);
                                                    updateNodeData({ buttons: newButtons });
                                                }}
                                                className={cn(
                                                    "flex-1 h-8 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2",
                                                    btn.type === 'link' ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" : "text-slate-500 hover:bg-white dark:hover:bg-slate-700"
                                                )}
                                            >
                                                <Link2 className="w-3.5 h-3.5" />
                                                Link
                                            </button>
                                        </div>

                                        {btn.type === 'link' && (
                                            <div className="flex items-center gap-3 px-1">
                                                <Input
                                                    className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl text-[12px] px-3 focus:ring-blue-500/20 font-bold w-full text-blue-600 placeholder:text-slate-300 shadow-sm"
                                                    value={btn.url || ''}
                                                    onChange={(e) => {
                                                        const newButtons = buttons.map(b =>
                                                            b.id === btn.id ? { ...b, url: e.target.value } : b
                                                        );
                                                        setButtons(newButtons);
                                                        updateNodeData({ buttons: newButtons });
                                                    }}
                                                    placeholder="https://example.com"
                                                />
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-3">
                                            <DropdownMenu onOpenChange={(open) => { if (open) fetchTagsAndAgents(); }}>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="h-9 w-full bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] px-3 justify-start font-bold text-slate-500 hover:text-blue-600 uppercase tracking-widest shadow-sm">
                                                        <TagIcon className="w-3.5 h-3.5 mr-2 shrink-0 opacity-50" />
                                                        {btn.tagIds?.length ? `${btn.tagIds.length} Tags` : "Tags"}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto rounded-2xl shadow-2xl border-none p-2">
                                                    <DropdownMenuItem
                                                        className="p-2.5 border-b border-slate-50 mb-2 sticky top-0 bg-white dark:bg-slate-900 z-10 focus:bg-blue-50 rounded-xl"
                                                        onSelect={() => {
                                                            setActiveTagButtonId(btn.id);
                                                            setIsTagModalOpen(true);
                                                        }}
                                                    >
                                                        <div className="flex items-center gap-2 text-blue-600 font-bold text-[11px] w-full cursor-pointer uppercase tracking-widest">
                                                            <Plus className="w-4 h-4" />
                                                            Create Tag
                                                        </div>
                                                    </DropdownMenuItem>
                                                    {availableTags.map(tag => (
                                                        <div key={tag.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer" onClick={(e) => { e.stopPropagation(); handleToggleTag(btn.id, tag.id); }}>
                                                            <Checkbox checked={(btn.tagIds || []).includes(tag.id)} onCheckedChange={() => handleToggleTag(btn.id, tag.id)} />
                                                            <span className="text-[12px] font-bold flex-1 truncate">{tag.name}</span>
                                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color || '#3b82f6' }} />
                                                        </div>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>

                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="outline" className="h-9 w-full bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] px-3 justify-start font-bold text-slate-500 hover:text-blue-600 uppercase tracking-widest shadow-sm">
                                                        <User className="w-3.5 h-3.5 mr-2 shrink-0 opacity-50" />
                                                        {btn.agentIds?.length ? `${btn.agentIds.length} Agents` : "Assign"}
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto rounded-2xl shadow-2xl border-none p-2">
                                                    <div className="px-3 py-2 border-b border-slate-50 mb-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Team Members</span>
                                                    </div>
                                                    {availableAgents.map(agent => (
                                                        <div key={agent.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl cursor-pointer" onClick={(e) => { e.stopPropagation(); handleToggleAgent(btn.id, agent.id); }}>
                                                            <Checkbox checked={(btn.agentIds || []).includes(agent.id)} onCheckedChange={() => handleToggleAgent(btn.id, agent.id)} />
                                                            <div className="flex flex-col flex-1 truncate">
                                                                <span className="text-[12px] font-bold truncate">{agent.name}</span>
                                                                <span className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-tighter">{agent.department?.name || 'Support'}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {buttons.length < (data.platform?.includes('INSTAGRAM') ? 13 : 3) && (
                                <Button
                                    variant="outline"
                                    onClick={handleAddButton}
                                    className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 justify-center h-12 rounded-2xl shadow-sm text-xs font-bold uppercase tracking-widest transition-all hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50/50 nodrag nopan mt-2"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add {data.platform?.includes('INSTAGRAM') ? 'Quick Reply' : 'Button'}
                                </Button>
                            )}
                        </div>

                        {/* Execution Settings */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-6 nodrag nopan">
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">{tCommon("executionSettings")}</label>
                                
                                <div className="space-y-2">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">{tCommon("responseDelay")}</span>
                                    <Input
                                        placeholder="e.g. 1.5"
                                        value={delay}
                                        onChange={(e) => {
                                            setDelay(e.target.value);
                                            updateNodeData({ delay: e.target.value });
                                        }}
                                        className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 rounded-xl text-sm font-bold shadow-sm focus:ring-blue-500/20 px-4"
                                    />
                                </div>

                                <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">{tCommon("enableTimeout")}</span>
                                    <Switch
                                        checked={timeoutEnabled}
                                        onCheckedChange={(checked) => {
                                            setTimeoutEnabled(checked);
                                            updateNodeData({ timeoutEnabled: checked });
                                        }}
                                        className="data-[state=checked]:bg-blue-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Add Content Button */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full bg-blue-600 text-white border-none justify-center h-12 rounded-2xl shadow-lg shadow-blue-600/20 text-xs font-bold uppercase tracking-[0.2em] transition-all hover:bg-blue-700 hover:scale-[1.02] active:scale-95 nodrag nopan"
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

                        {(!buttons || buttons.length === 0) && (
                            <div className="relative group/connect cursor-crosshair">
                                <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl h-14 flex items-center justify-center group-hover/connect:border-blue-400 transition-all">
                                    <span className="text-slate-400 text-xs font-bold uppercase tracking-widest group-hover/connect:text-blue-500 transition-colors">{tCommon("connectNode")}</span>
                                </div>
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id="right"
                                    className="w-5! h-5! border-[3px]! border-white! bg-blue-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50! cursor-crosshair! shadow-lg"
                                    style={{ pointerEvents: 'all' }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
});

MessageNode.displayName = 'MessageNode';


MessageNode.displayName = 'MessageNode';


