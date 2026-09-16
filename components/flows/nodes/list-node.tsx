import { memo, useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import {
    List, Layout, Copy, Trash2, Plus, Eye, XCircle, X,
    MousePointerClick, Image as ImageIcon, ShoppingCart,
    ShoppingBag, Zap, User, ChevronUp, ChevronDown, Tag as TagIcon, Sparkles
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { getTags, createTag } from '@/app/actions/tags';
import { getAgents } from '@/app/actions/agents';
import { CreateTagModal } from '@/components/flows/modals/create-tag-modal';

export const ListNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
    const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();

    // List Specific State
    const [header, setHeader] = useState(data.header || '');
    const [body, setBody] = useState(data.body || '');
    const [footer, setFooter] = useState(data.footer || '');
    const [buttonText, setButtonText] = useState(data.buttonText || 'View Options');
    const [sections, setSections] = useState<any[]>(data.sections || []);
    const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

    const toggleSectionCollapse = (sectionId: string) => {
        setCollapsedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };
    const [delay, setDelay] = useState(data.delay || '');
    const [timeoutEnabled, setTimeoutEnabled] = useState(data.timeoutEnabled || false);
    const [timeoutValue, setTimeoutValue] = useState(data.timeoutValue || 24);
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
            nds.map((node) => {
                if (node.id === id) {
                    return {
                        ...node,
                        data: {
                            ...node.data,
                            ...newData,
                        },
                    };
                }
                return node;
            })
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

    const handleAddSection = useCallback(() => {
        const newSection = {
            id: `section-${Date.now()}`,
            title: '',
            items: []
        };
        const updated = [...sections, newSection];
        setSections(updated);
        updateNodeData({ sections: updated });
    }, [sections]);

    const handleRemoveSection = useCallback((sectionId: string) => {
        const updated = sections.filter(s => s.id !== sectionId);
        setSections(updated);
        updateNodeData({ sections: updated });
    }, [sections]);

    const handleAddItem = useCallback((sectionId: string) => {
        const updated = sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: [...s.items, { id: `item-${Date.now()}`, title: '', description: '' }]
                };
            }
            return s;
        });
        setSections(updated);
        updateNodeData({ sections: updated });
    }, [sections]);

    const handleUpdateItem = useCallback((sectionId: string, itemId: string, field: string, value: string) => {
        const updated = sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: s.items.map((item: any) => item.id === itemId ? { ...item, [field]: value } : item)
                };
            }
            return s;
        });
        setSections(updated);
        updateNodeData({ sections: updated });
    }, [sections]);

    const handleRemoveItem = useCallback((sectionId: string, itemId: string) => {
        const updated = sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: s.items.filter((item: any) => item.id !== itemId)
                };
            }
            return s;
        });
        setSections(updated);
        updateNodeData({ sections: updated });
    }, [sections]);

    const handleToggleItemTag = useCallback((sectionId: string, itemId: string, tagId: string) => {
        const updated = sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: s.items.map((item: any) => {
                        if (item.id !== itemId) return item;
                        const tagIds = item.tagIds || [];
                        const newTagIds = tagIds.includes(tagId)
                            ? tagIds.filter((id: string) => id !== tagId)
                            : [...tagIds, tagId];
                        return { ...item, tagIds: newTagIds };
                    })
                };
            }
            return s;
        });
        setSections(updated);
        updateNodeData({ sections: updated });
    }, [sections]);

    const handleToggleItemAgent = useCallback((sectionId: string, itemId: string, agentId: string) => {
        const updated = sections.map(s => {
            if (s.id === sectionId) {
                return {
                    ...s,
                    items: s.items.map((item: any) => {
                        if (item.id !== itemId) return item;
                        const agentIds = item.agentIds || [];
                        const newAgentIds = agentIds.includes(agentId)
                            ? agentIds.filter((id: string) => id !== agentId)
                            : [...agentIds, agentId];
                        return { ...item, agentIds: newAgentIds };
                    })
                };
            }
            return s;
        });
        setSections(updated);
        updateNodeData({ sections: updated });
    }, [sections]);

    const handleCreateTag = async (tagData: { name: string }) => {
        try {
            const res: any = await createTag(tagData.name, undefined, undefined);
            if (res.error) {
                toast.error(res.error);
                return;
            }
            const newTag = res.data;
            toast.success(`Tag "${tagData.name}" created`);
            setAvailableTags(prev => [...prev, newTag]);
        } catch (error) {
            toast.error("Failed to create tag");
        }
    };

    return (
        <>
            <CreateTagModal 
                isOpen={isTagModalOpen} 
                onClose={() => setIsTagModalOpen(false)} 
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
                                <List className="w-6 h-6 text-emerald-500" />
                            </div>
                            <span className="font-bold text-xl text-emerald-600 dark:text-emerald-400 tracking-tight">{tNodes("listMessage")}</span>
                        </div>
                    </div>

                    {/* Content Container */}
                    <div className="p-6 space-y-6">
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-5 nodrag nopan">
                            <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">List Header</label>
                            
                            {/* Header Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Header Text</span>
                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{header.length}/20</span>
                                </div>
                                <Input
                                    placeholder="Optional header..."
                                    value={header}
                                    onChange={(e) => {
                                        setHeader(e.target.value);
                                        updateNodeData({ header: e.target.value });
                                    }}
                                    className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-emerald-500/20 px-4 shadow-sm"
                                />
                            </div>

                            {/* Body Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Body Message</span>
                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{body.length}/1024</span>
                                </div>
                                <Input
                                    placeholder="Type your message..."
                                    value={body}
                                    onChange={(e) => {
                                        setBody(e.target.value);
                                        updateNodeData({ body: e.target.value });
                                    }}
                                    className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-14 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-emerald-500/20 px-4 shadow-sm"
                                />
                            </div>

                            {/* Footer Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Footer Text</span>
                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{footer.length}/60</span>
                                </div>
                                <Input
                                    placeholder="Optional footer..."
                                    value={footer}
                                    onChange={(e) => {
                                        setFooter(e.target.value);
                                        updateNodeData({ footer: e.target.value });
                                    }}
                                    className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-emerald-500/20 px-4 shadow-sm"
                                />
                            </div>

                            <div className="space-y-2 pt-2">
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Button Title</span>
                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{buttonText.length}/20</span>
                                </div>
                                <Input
                                    placeholder="e.g. View Menu"
                                    maxLength={20}
                                    value={buttonText}
                                    onChange={(e) => {
                                        const val = e.target.value.slice(0, 20);
                                        setButtonText(val);
                                        updateNodeData({ buttonText: val });
                                    }}
                                    className="bg-emerald-600 border-none h-12 text-white font-bold rounded-2xl focus-visible:ring-emerald-500/20 text-center shadow-lg shadow-emerald-600/20 placeholder:text-emerald-100/50 uppercase tracking-[0.15em] text-xs"
                                />
                            </div>
                        </div>

                        {/* Dynamic Sections */}
                        <div className="space-y-4">
                            {sections.length > 0 && (
                                <div className="flex justify-between items-center px-1">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                                        Sections ({sections.length})
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const allCollapsed = sections.every(s => collapsedSections[s.id]);
                                            const nextState: Record<string, boolean> = {};
                                            sections.forEach(s => { nextState[s.id] = !allCollapsed; });
                                            setCollapsedSections(nextState);
                                        }}
                                        className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                                    >
                                        {sections.every(s => collapsedSections[s.id]) ? 'Expand All' : 'Collapse All'}
                                    </button>
                                </div>
                            )}

                            {sections.map((section, sIndex) => {
                                const isCollapsed = !!collapsedSections[section.id];
                                const itemCount = section.items?.length || 0;
                                return (
                                    <div key={section.id} className="group/section relative bg-slate-50/80 dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-700/50 rounded-[24px] p-5 space-y-4 hover:border-emerald-400/50 transition-all animate-in fade-in slide-in-from-top-2 duration-200 nodrag nopan">
                                        <button
                                            onClick={() => handleRemoveSection(section.id)}
                                            className="absolute -top-2 -left-2 w-8 h-8 bg-white dark:bg-slate-900 border border-slate-100 rounded-full shadow-lg flex items-center justify-center text-slate-400 hover:text-red-500 transition-all z-10 hover:scale-110"
                                        >
                                            <XCircle className="w-5 h-5" />
                                        </button>

                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600">Section {sIndex + 1}</span>
                                                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                                                        {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleSectionCollapse(section.id)}
                                                        className="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-slate-600 dark:text-slate-300 transition-all cursor-pointer flex items-center gap-1.5 text-[10px] font-bold shadow-xs active:scale-95"
                                                    >
                                                        {isCollapsed ? (
                                                            <>
                                                                <span>Open</span>
                                                                <ChevronDown className="w-3.5 h-3.5 text-emerald-600" />
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span>Close</span>
                                                                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                                                            </>
                                                        )}
                                                    </button>
                                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{section.title.length}/24</span>
                                                </div>
                                            </div>
                                            <Input
                                                placeholder="Section Title"
                                                maxLength={24}
                                                value={section.title}
                                                onChange={(e) => {
                                                    const val = e.target.value.slice(0, 24);
                                                    const updated = sections.map(s => s.id === section.id ? { ...s, title: val } : s);
                                                    setSections(updated);
                                                    updateNodeData({ sections: updated });
                                                }}
                                                className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl focus-visible:ring-emerald-500/20 px-4 shadow-sm"
                                            />
                                        </div>

                                        {!isCollapsed && (
                                            <div className="space-y-3">
                                                {section.items?.map((item: any) => (
                                                    <div key={item.id} className="group/item relative bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4 hover:border-emerald-400/30 transition-all shadow-sm">
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center justify-between">
                                                                <Input
                                                                    placeholder="Item Title"
                                                                    maxLength={24}
                                                                    value={item.title}
                                                                    onChange={(e) => handleUpdateItem(section.id, item.id, 'title', e.target.value.slice(0, 24))}
                                                                    className="h-6 border-none bg-transparent focus-visible:ring-0 p-0 text-[14px] font-bold text-slate-700 dark:text-slate-200"
                                                                />
                                                                <button
                                                                    onClick={() => handleRemoveItem(section.id, item.id)}
                                                                    className="opacity-0 group-hover/item:opacity-100 p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                            <Input
                                                                placeholder="Description (Optional)"
                                                                maxLength={72}
                                                                value={item.description}
                                                                onChange={(e) => handleUpdateItem(section.id, item.id, 'description', e.target.value.slice(0, 72))}
                                                                className="h-5 border-none bg-transparent focus-visible:ring-0 p-0 text-[11px] font-bold text-slate-400"
                                                            />

                                                            {/* Tags and Agent Selectors for Item */}
                                                            <div className="mt-3 pt-3 border-t border-slate-50 dark:border-slate-800 flex flex-col gap-3">
                                                                <div className="flex gap-2">
                                                                    <DropdownMenu onOpenChange={(open) => { if (open) fetchTagsAndAgents(); }}>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <button className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors border border-slate-100/50">
                                                                                <TagIcon className="w-3.5 h-3.5 opacity-50" />
                                                                                {item.tagIds?.length ? `${item.tagIds.length} Tags` : "Tags"}
                                                                            </button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto rounded-2xl shadow-2xl border-none p-2">
                                                                            <DropdownMenuItem 
                                                                                className="p-2.5 border-b border-slate-50 mb-2 sticky top-0 bg-white z-10 focus:bg-emerald-50 rounded-xl"
                                                                                onSelect={() => setIsTagModalOpen(true)}
                                                                            >
                                                                                <div className="flex items-center gap-3 text-emerald-600 font-bold text-[11px] w-full cursor-pointer uppercase tracking-widest">
                                                                                    <Plus className="w-4 h-4" />
                                                                                    Create Tag
                                                                                </div>
                                                                            </DropdownMenuItem>
                                                                            {(availableTags?.length || 0) === 0 ? (
                                                                                <div className="p-4 text-[10px] text-slate-400 italic text-center font-bold">No tags available</div>
                                                                            ) : (
                                                                                <div className="grid gap-1">
                                                                                    {availableTags.map(tag => (
                                                                                        <div key={tag.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); handleToggleItemTag(section.id, item.id, tag.id); }}>
                                                                                            <Checkbox checked={(item.tagIds || []).includes(tag.id)} onCheckedChange={() => handleToggleItemTag(section.id, item.id, tag.id)} className="border-slate-200 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
                                                                                            <span className="text-[12px] font-bold flex-1 truncate text-slate-700">{tag.name}</span>
                                                                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag.color || '#10B981' }} />
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>

                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <button className="flex-1 flex items-center justify-center gap-2 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-[10px] font-bold text-slate-500 hover:text-emerald-600 transition-colors border border-slate-100/50">
                                                                                <User className="w-3.5 h-3.5 opacity-50" />
                                                                                {item.agentIds?.length ? `${item.agentIds.length} Agents` : "Assign"}
                                                                            </button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent align="start" className="w-[200px] max-h-[300px] overflow-y-auto rounded-2xl shadow-2xl border-none p-2">
                                                                            <div className="px-3 py-2 border-b border-slate-50 mb-2">
                                                                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Team Members</span>
                                                                            </div>
                                                                            {(availableAgents?.length || 0) === 0 ? (
                                                                                <div className="p-4 text-[10px] text-slate-400 italic text-center font-bold">No agents found</div>
                                                                            ) : (
                                                                                <div className="grid gap-1">
                                                                                    {availableAgents.map(agent => (
                                                                                        <div key={agent.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); handleToggleItemAgent(section.id, item.id, agent.id); }}>
                                                                                            <Checkbox checked={(item.agentIds || []).includes(agent.id)} onCheckedChange={() => handleToggleItemAgent(section.id, item.id, agent.id)} className="border-slate-200 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600" />
                                                                                            <div className="flex flex-col flex-1 truncate">
                                                                                                <span className="text-[12px] font-bold truncate text-slate-700">{agent.name}</span>
                                                                                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{agent.department?.name || 'Support'}</span>
                                                                                            </div>
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Item Handle */}
                                                        <Handle
                                                            type="source"
                                                            position={Position.Right}
                                                            id={item.id}
                                                            className="w-5! h-5! border-[3px]! border-white! bg-emerald-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50 transition-all hover:scale-125 cursor-crosshair shadow-lg"
                                                            style={{ pointerEvents: 'all' }}
                                                        />

                                                        {/* Floating Plus Button for connecting from item */}
                                                        <div className="absolute -right-12 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 transition-all z-50">
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <button className="w-8 h-8 bg-emerald-600 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all">
                                                                        <Plus className="w-5 h-5" />
                                                                    </button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="start" side="right" sideOffset={15} className="w-[220px] p-2 rounded-2xl shadow-2xl border-none bg-white dark:bg-slate-900 z-[100]">
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
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => handleAddItem(section.id)}
                                                    className="w-full h-11 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all shadow-sm"
                                                >
                                                    <Plus className="w-4 h-4 mr-2" />
                                                    Add Item
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            <Button
                                variant="outline"
                                onClick={handleAddSection}
                                className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 justify-center h-12 rounded-2xl shadow-sm text-xs font-bold uppercase tracking-widest transition-all hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/50 nodrag nopan"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Add Section
                            </Button>
                        </div>

                        {/* Execution Settings */}
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-6 nodrag nopan">
                            <div className="space-y-4">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">{tCommon("executionSettings")}</label>
                                
                                <div className="space-y-2">
                                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">{tCommon("responseDelay")}</span>
                                    <Input
                                        type="number"
                                        placeholder="0s"
                                        value={delay}
                                        onChange={(e) => {
                                            setDelay(e.target.value);
                                            updateNodeData({ delay: e.target.value });
                                        }}
                                        className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 rounded-xl text-sm font-bold shadow-sm focus:ring-emerald-500/20 px-4"
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

                                {timeoutEnabled && (
                                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="space-y-2">
                                            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 ml-1">Timeout Duration (min)</span>
                                            <div className="relative">
                                                <Input
                                                    placeholder="Enter in minutes"
                                                    type="number"
                                                    value={timeoutValue}
                                                    onChange={(e) => {
                                                        const val = Number(e.target.value);
                                                        setTimeoutValue(val);
                                                        updateNodeData({ timeoutValue: val });
                                                    }}
                                                    className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus:ring-emerald-500/20 px-4 pr-16"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold uppercase tracking-tighter">Minutes</span>
                                            </div>
                                        </div>

                                        <div className="relative group/timeout cursor-crosshair mt-4">
                                            <div className="bg-slate-100/50 dark:bg-slate-900/50 border border-dashed border-emerald-500/30 rounded-2xl h-12 flex items-center justify-center group-hover/timeout:border-emerald-500 transition-all">
                                                <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-widest">After Timeout</span>
                                            </div>
                                            <Handle
                                                type="source"
                                                position={Position.Right}
                                                id="timeout"
                                                className="w-5! h-5! border-[3px]! border-white! bg-emerald-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50! cursor-crosshair! shadow-lg"
                                                style={{ pointerEvents: 'all' }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

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
                                        className="p-2.5 cursor-pointer rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 focus:bg-indigo-50 dark:focus:bg-indigo-900/20 flex items-center group/item"
                                    >
                                        <div className="w-10 h-10 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center mr-4 shrink-0 transition-transform group-hover/item:scale-110">
                                            <ImageIcon className="w-5 h-5 text-indigo-600" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-[14px] font-bold text-slate-700 dark:text-slate-200">{tCommon("media")}</span>
                                            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter">{tCommon("imageVideoAudio")}</span>
                                        </div>
                                    </DropdownMenuItem>
                                </div>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="relative group/connect cursor-crosshair">
                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl h-14 flex items-center justify-center group-hover/connect:border-emerald-400 transition-all">
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest group-hover/connect:text-emerald-500 transition-colors">After List</span>
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
        </>
    );
});

ListNode.displayName = 'ListNode';
