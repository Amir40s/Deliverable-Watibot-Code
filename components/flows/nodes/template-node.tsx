import { memo, useState } from'react';
import { Handle, Position, NodeProps, useReactFlow } from'reactflow';
import { toast } from'sonner';
import { useTranslations } from 'next-intl';
import { 
 Image as ImageIcon, List, ShoppingCart, ShoppingBag, Zap, User,
 Layout, Copy, Trash2, ChevronUp, Plus, X, MousePointerClick, Link2
} from'lucide-react';
import { Button } from'@/components/ui/button';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from'@/lib/utils';
import { Input } from '@/components/ui/input';
import { TemplateSelectionModal } from'@/components/flows/modals/template-selection-modal';

export const TemplateNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const updateNodeData = (newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const handleTemplateSelect = (template: any) => {
    console.log('[TemplateNode] Selected Template:', template);
    
    // Extract components safely
    const components = template.components || [];
    
    // Extract variables from body
    const bodyComponent = components.find((c: any) => c.type?.toUpperCase() === 'BODY');
    const text = bodyComponent?.text || '';
    
    // Extract buttons - Meta can have multiple types of buttons
    const buttonsComponent = components.find((c: any) => c.type?.toUpperCase() === 'BUTTONS');
    const buttons = buttonsComponent?.buttons || [];
    
    console.log('[TemplateNode] Extracted Buttons:', buttons);

    const variableMatches = text.match(/{{(\d+)}}/g) || [];
    const variables = variableMatches.reduce((acc: any, match: string) => {
      const num = match.replace(/{{|}}/g, '');
      acc[num] = data.variables?.[num] || '';
      return acc;
    }, {});

    updateNodeData({
      templateName: template.name,
      templateId: template.id,
      templateBody: text,
      variables,
      buttons,
      language: template.language
    });
    setIsTemplateModalOpen(false);
    toast.success(`Template "${template.name}" selected with ${buttons.length} buttons`);
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
              <Layout className="w-5 h-5 text-[#00B074]" />
              <span className="font-bold text-[#00B074] tracking-tight">{tNodes("templateMessage")}</span>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-4 space-y-4">
          <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4">
            {/* Select Template Placeholder */}
            {!data.templateName ? (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsTemplateModalOpen(true);
                }}
                className="bg-white dark:bg-slate-900 rounded-2xl h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group/template nodrag nopan"
              >
                <div className="w-10 h-10 rounded-full bg-[#00B074]/10 dark:bg-[#00B074]/20 flex items-center justify-center mb-2 group-hover/template:scale-110 transition-transform">
                  <Layout className="w-5 h-5 text-[#00B074]" />
                </div>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wide uppercase">Select Template</span>
              </div>
            ) : (
              <div className="space-y-4 nodrag nopan">
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTemplateModalOpen(true);
                  }}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group/template shadow-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Layout className="w-4 h-4 text-[#00B074]" />
                      <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{data.templateName}</span>
                    </div>
                    <span className="text-[10px] font-bold text-[#00B074] bg-[#00B074]/10 px-2 py-0.5 rounded-full uppercase">{data.language || 'EN'}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-3 leading-relaxed bg-[#F8F9FA] dark:bg-slate-800/50 p-2 rounded-lg italic border border-slate-100 dark:border-slate-800">
                    {data.templateBody}
                  </p>
                </div>

                {/* Variables Section */}
                {data.variables && Object.keys(data.variables).length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2 px-1">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Template Variables</span>
                    </div>
                    <div className="space-y-3">
                      {Object.keys(data.variables).map((num) => (
                        <div key={num} className="space-y-1.5">
                          <div className="flex justify-between items-center px-1">
                            <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">Variable {num}</label>
                            <span className="text-[10px] text-slate-400 font-mono italic">{"{{ " + num + " }}"}</span>
                          </div>
                          <div className="relative group/var">
                            <Input 
                              placeholder={`Value for {{${num}}} (e.g. {{contact.name}})`}
                              value={data.variables[num] || ''}
                              onChange={(e:any) => {
                                const newVars = { ...data.variables, [num]: e.target.value };
                                updateNodeData({ variables: newVars });
                              }}
                              className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-9 rounded-xl text-xs shadow-sm focus-visible:ring-[#00B074]/20 px-3 pr-10"
                            />
                            {data.platform === 'SHOPIFY' && (
                              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-emerald-600">
                                      <Plus className="w-3.5 h-3.5" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl rounded-xl p-1">
                                    <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Shopify Variables</div>
                                    {[
                                      { label: 'Order Number', value: '{{order.number}}' },
                                      { label: 'Total Price', value: '{{order.total}}' },
                                      { label: 'Currency', value: '{{order.currency}}' },
                                      { label: 'First Name', value: '{{customer.firstName}}' },
                                      { label: 'Last Name', value: '{{customer.lastName}}' },
                                      { label: 'Email', value: '{{customer.email}}' },
                                      { label: 'Shop Name', value: '{{shop.name}}' },
                                    ].map((variable) => (
                                      <DropdownMenuItem 
                                        key={variable.value}
                                        onClick={() => {
                                          const newVars = { ...data.variables, [num]: variable.value };
                                          updateNodeData({ variables: newVars });
                                        }}
                                        className="text-xs py-2 px-2 rounded-lg cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-700 dark:text-slate-200"
                                      >
                                        <div className="flex flex-col">
                                          <span className="font-medium">{variable.label}</span>
                                          <span className="text-[10px] text-slate-400 font-mono">{variable.value}</span>
                                        </div>
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-slate-400 px-1 italic">Use {"{{contact.name}}"} to insert contact details dynamically.</p>
                  </div>
                )}
                {/* Buttons Section */}
                {(!data.buttons || data.buttons.length === 0) && data.templateName && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-[10px] text-slate-400 italic px-1">No interactive buttons detected in this template.</p>
                  </div>
                )}
                {data.buttons && data.buttons.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    {data.buttons.map((btn: any, index: number) => (
                      <div key={index} className="relative group/btn nodrag nopan">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-2">
                              {btn.type === 'QUICK_REPLY' ? (
                                <MousePointerClick className="w-3 h-3 text-[#00B074]" />
                              ) : btn.type === 'URL' ? (
                                <Link2 className="w-3 h-3 text-blue-500" />
                              ) : (
                                <Zap className="w-3 h-3 text-amber-500" />
                              )}
                              <span className="text-[12px] font-medium text-slate-700 dark:text-slate-200">{btn.text}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 uppercase font-bold">{btn.type?.replace('_', ' ')}</span>
                          </div>
                          {btn.type === 'QUICK_REPLY' && (
                            <Handle
                              type="source"
                              position={Position.Right}
                              id={btn.text}
                              className={cn(
                                "w-4 h-4 border-2 border-white bg-emerald-500 rounded-full absolute -right-2 top-1/2 -translate-y-1/2 z-50 transition-all hover:scale-150 cursor-crosshair shadow-[0_0_8px_rgba(16,185,129,0.5)]",
                                "after:content-[''] after:absolute after:inset-[-10px] after:rounded-full after:cursor-crosshair" // Even larger grab area
                              )}
                              style={{ pointerEvents: 'all' }}
                            />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 justify-center h-11 rounded-xl shadow-sm font-bold text-xs uppercase tracking-widest transition-all nodrag nopan"
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

          {(!data.buttons || data.buttons.length === 0) && (
            <div className="relative group/connect cursor-pointer">
              <div className="bg-white dark:bg-slate-900 border border-[#00B074]/20 rounded-2xl h-12 flex items-center px-5 group-hover/connect:bg-[#00B074]/5 transition-all nodrag nopan">
                <span className="text-[#00B074] dark:text-[#00B074] text-[10px] font-bold uppercase tracking-widest">Next Step</span>
              </div>
              <Handle
                type="source"
                position={Position.Right}
                id="right"
                className="w-4! h-4! border-[3px]! border-[#00B074]! bg-[#F0F3F1]! dark:bg-slate-800! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
                style={{ pointerEvents:'all' }}
              />
            </div>
          )}
        </div>
        
      </div>

      <TemplateSelectionModal 
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        onSelect={handleTemplateSelect}
      />
    </div>
  );
});

TemplateNode.displayName ='TemplateNode';
