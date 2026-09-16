import { memo, useState } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { useTranslations } from 'next-intl';
import {
  ShoppingBag, Copy, Trash2, Plus, Eye, X, MousePointerClick,
  Image as ImageIcon, List, ShoppingCart, Zap, User, MessageSquare, ChevronUp, ChevronDown
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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ProductSelectionModal } from '@/components/flows/modals/product-selection-modal';

export const MultiProductNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // State
  const [header, setHeader] = useState(data.header || '');
  const [body, setBody] = useState(data.body || '');
  const [footer, setFooter] = useState(data.footer || '');
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
    const newSections = [...sections, {
      id: `section-${Date.now()}`,
      title: '',
      items: []
    }];
    setSections(newSections);
    updateNodeData({ sections: newSections });
  };

  const handleRemoveSection = (sectionId: string) => {
    const newSections = sections.filter(s => s.id !== sectionId);
    setSections(newSections);
    updateNodeData({ sections: newSections });
  };

  const handleUpdateSection = (sectionId: string, title: string) => {
    const newSections = sections.map(s => s.id === sectionId ? { ...s, title } : s);
    setSections(newSections);
    updateNodeData({ sections: newSections });
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
          style={{ pointerEvents: 'all' }}
        />

        {/* Header Area */}
        <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px]">
          <div className="flex items-center">
            <div className="w-1.5 h-14 bg-[#00B074]" />
            <div className="flex items-center gap-3 px-4">
              <ShoppingBag className="w-5 h-5 text-[#00B074]" />
              <span className="font-bold text-[#00B074] tracking-tight text-[15px]">{tNodes("multiProduct")}</span>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-4 space-y-4">
          {/* Grouped Message Inputs */}
          <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4 shadow-sm nodrag nopan">
            {/* Header Input */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Header (Optional)</label>
                <span className="text-[10px] font-mono text-slate-400">{header.length}/20</span>
              </div>
              <Input
                placeholder="Enter header text"
                value={header}
                onChange={(e) => {
                  setHeader(e.target.value);
                  updateNodeData({ header: e.target.value });
                }}
                className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium px-4 rounded-xl focus-visible:ring-0 placeholder:text-slate-400"
              />
            </div>

            {/* Body Input */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Body</label>
                <span className="text-[10px] font-mono text-slate-400">{body.length}/1024</span>
              </div>
              <Input
                placeholder="Enter message body"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  updateNodeData({ body: e.target.value });
                }}
                className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium px-4 rounded-xl focus-visible:ring-0 placeholder:text-slate-400"
              />
            </div>

            {/* Footer Input */}
            <div className="space-y-1.5 pb-1">
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
                className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium px-4 rounded-xl focus-visible:ring-0 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="space-y-3">
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
                  className="text-[10px] font-bold text-[#00B074] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {sections.every(s => collapsedSections[s.id]) ? 'Expand All' : 'Collapse All'}
                </button>
              </div>
            )}

            {sections.map((section, sIndex) => {
              const isCollapsed = !!collapsedSections[section.id];
              return (
                <div key={section.id} className="group/section relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 pt-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 hover:border-[#00B074]/30 transition-all">
                  <button
                    onClick={() => handleRemoveSection(section.id)}
                    className="absolute top-2 left-2 w-5 h-5 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors z-10 shadow-sm"
                  >
                    <X className="w-3 h-3" />
                  </button>

                  <div className="flex justify-between items-center mb-1 pl-6">
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#00B074]">Section {sIndex + 1}</span>
                    <button
                      type="button"
                      onClick={() => toggleSectionCollapse(section.id)}
                      className="px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 rounded-lg text-slate-600 dark:text-slate-300 transition-all cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                    >
                      {isCollapsed ? (
                        <>
                          <span>Expand</span>
                          <ChevronDown className="w-3 h-3 text-[#00B074]" />
                        </>
                      ) : (
                        <>
                          <span>Collapse</span>
                          <ChevronUp className="w-3 h-3 text-slate-400" />
                        </>
                      )}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <div className="relative">
                      <Input
                        placeholder="Section Title"
                        value={section.title}
                        onChange={(e) => handleUpdateSection(section.id, e.target.value)}
                        className="bg-transparent border-none h-8 text-slate-700 dark:text-slate-200 font-bold p-0 focus-visible:ring-0 placeholder:text-slate-300"
                      />
                      <div className="absolute top-1/2 -translate-y-1/2 right-0 text-[10px] font-bold text-slate-300">{section.title?.length || 0}/24</div>
                    </div>
                  </div>

                  {!isCollapsed && (
                    <div className="mt-3">
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsProductModalOpen(true);
                        }}
                        className="w-full h-10 bg-white dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-400 text-[11px] font-bold uppercase tracking-widest rounded-xl shadow-sm nodrag nopan transition-all"
                      >
                        + Add Products
                      </Button>
                    </div>
                  )}

                  {/* Section Handle */}
                  <Handle
                    type="source"
                    position={Position.Right}
                    id={section.id}
                    className="w-3! h-3! border-2! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! -right-1.5! top-1/2! -translate-y-1/2! z-50! opacity-0 group-hover/section:opacity-100 transition-opacity cursor-crosshair"
                  />

                  {/* Add content from section button */}
                  <div className="absolute -right-8 top-1/2 -translate-y-1/2 opacity-0 group-hover/section:opacity-100 transition-opacity z-50">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-6 h-6 bg-[#00B074] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="right" sideOffset={10} className="w-[200px] p-2 rounded-2xl shadow-xl border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'message', section.id)} className="flex items-center p-2 rounded-xl cursor-pointer hover:bg-slate-50">
                          <MousePointerClick className="w-4 h-4 mr-2 text-[#00B074]" />
                          <span className="text-[13px] font-medium">Text + Button</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'media', section.id)} className="flex items-center p-2 rounded-xl cursor-pointer hover:bg-slate-50">
                          <ImageIcon className="w-4 h-4 mr-2 text-[#00B074]" />
                          <span className="text-[13px] font-medium">{tCommon("media")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => data.onAddNodeAndConnect?.(id, 'list', section.id)} className="flex items-center p-2 rounded-xl cursor-pointer hover:bg-slate-50">
                          <List className="w-4 h-4 mr-2 text-[#00B074]" />
                          <span className="text-[13px] font-medium">List</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Timing configuration */}
          <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4 nodrag nopan">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 px-1">Set Delay (Seconds)</label>
              <Input
                placeholder="e.g. 2.0"
                value={delay}
                onChange={(e) => {
                  setDelay(e.target.value);
                  updateNodeData({ delay: e.target.value });
                }}
                className="bg-white dark:bg-slate-900 border-none h-10 rounded-xl text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-slate-300 px-4 placeholder:text-slate-400"
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

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleAddSection();
              }}
              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 h-10 rounded-xl shadow-sm text-[11px] font-bold uppercase tracking-widest nodrag nopan"
            >
              + Add Section
            </Button>
          </div>

          {/* Add Content Dropdown */}
          <div className="pt-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 justify-center h-10 rounded-xl shadow-sm font-bold text-[11px] uppercase tracking-widest transition-all nodrag nopan"
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
                    onClick={() => data.onAddNodeAndConnect?.(id, 'message')}
                    className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
                  >
                    <div className="w-8 h-8 bg-[#00B074]/10 dark:bg-[#00B074]/20 rounded-lg flex items-center justify-center mr-3 shrink-0">
                      <MousePointerClick className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
                    </div>
                    <span className="text-[14px] text-slate-700 dark:text-slate-200">Text + Button</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => data.onAddNodeAndConnect?.(id, 'media')}
                    className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
                  >
                    <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
                      <ImageIcon className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
                    </div>
                    <span className="text-[14px] text-slate-700 dark:text-slate-200">{tCommon("media")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => data.onAddNodeAndConnect?.(id, 'list')}
                    className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
                  >
                    <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
                      <List className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
                    </div>
                    <span className="text-[14px] text-slate-700 dark:text-slate-200">{tNodes("listMessage")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => data.onAddNodeAndConnect?.(id, 'single_product')}
                    className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
                  >
                    <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
                      <ShoppingCart className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
                    </div>
                    <span className="text-[14px] text-slate-700 dark:text-slate-200">{tNodes("singleProduct")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => data.onAddNodeAndConnect?.(id, 'multi_product')}
                    className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
                  >
                    <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
                      <ShoppingBag className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
                    </div>
                    <span className="text-[14px] text-slate-700 dark:text-slate-200">{tNodes("multiProduct")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => data.onAddNodeAndConnect?.(id, 'catalogue')}
                    className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
                  >
                    <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
                      <ShoppingCart className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
                    </div>
                    <span className="text-[14px] text-slate-700 dark:text-slate-200">{tNodes("catalogue")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => data.onAddNodeAndConnect?.(id, 'template')}
                    className="p-2 cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 focus:bg-slate-50 dark:focus:bg-slate-800 flex items-center"
                  >
                    <div className="w-8 h-8 bg-[#EFECE5] dark:bg-slate-800 rounded-lg flex items-center justify-center mr-3 shrink-0">
                      <Zap className="w-4 h-4 text-[#00B074] dark:text-[#00B074]" />
                    </div>
                    <span className="text-[14px] text-slate-700 dark:text-slate-200">Template</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => data.onAddNodeAndConnect?.(id, 'request_intervention')}
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
          </div>

          <div className="relative group/connect cursor-pointer pt-1">
            <div className="bg-white dark:bg-slate-900 border border-[#00B074]/20 rounded-2xl h-[44px] flex items-center justify-center group-hover/connect:bg-[#00B074]/5 transition-all shadow-sm nodrag nopan">
              <span className="text-[#00B074] dark:text-[#00B074] text-[15px] font-medium tracking-tight pr-4">Connect Component</span>
              <Handle
                type="source"
                position={Position.Right}
                id="right"
                className="w-4! h-4! border-[3px]! border-[#00B074]! bg-[#F0F3F1]! dark:bg-slate-800! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
                style={{ pointerEvents: 'all' }}
              />
            </div>
          </div>
        </div>

      </div>

      <ProductSelectionModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSelect={(product) => {
          console.log('Selected items:', product);
          setIsProductModalOpen(false);
        }}
      />
    </div>
  );
});

MultiProductNode.displayName = 'MultiProductNode';
