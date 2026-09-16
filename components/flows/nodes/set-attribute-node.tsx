import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { MessageSquareText, Copy, Trash2, ChevronUp, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export const SetAttributeNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { setNodes, deleteElements, getNode, addNodes } = useReactFlow();
  const [availableAttributes, setAvailableAttributes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [attribute, setAttribute] = useState(data.attribute || '');
  const [variableName, setVariableName] = useState(data.variableName || '');
  const [value, setValue] = useState(data.value || '');

  useEffect(() => {
    getCustomAttributes()
      .then(attrs => {
        setAvailableAttributes(attrs);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

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
          style={{ pointerEvents: 'all' }}
        />

        {/* Header */}
        <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px] relative">
          <div className="flex items-center">
            <div className="w-1.5 h-14 bg-[#00B074]" />
            <div className="flex items-center gap-3 px-4">
              <MessageSquareText className="w-5 h-5 text-[#00B074]" />
              <span className="font-bold text-[#00B074] tracking-tight">{tNodes("setAttribute")}</span>
            </div>
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id="right"
            className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!"
            style={{ pointerEvents: 'all' }}
          />
        </div>

        {/* Content Container */}
        <div className="p-4">
          <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4">
            {/* Select Attribute */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Select Attribute</label>
              <div className="relative">
                <Select 
                  value={attribute} 
                  onValueChange={(val) => {
                    setAttribute(val);
                    updateNodeData({ attribute: val });
                  }}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-none h-11 pl-9 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus:ring-[#00B074]/20 transition-all text-left nodrag nopan">
                    <SelectValue placeholder="Select attribute" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[200px] overflow-y-auto">
                    {/* Add options based on actual custom attributes from database */}
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
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center gap-1 pointer-events-none">
                  <span className="text-sm font-bold">$</span>
                </div>
              </div>
            </div>

            {/* Custom Variable Name Input - Only visible when Custom is selected */}
            {attribute === 'attr_custom' && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Variable Name</label>
                <Input
                  placeholder="e.g. user_choice"
                  value={variableName}
                  onChange={(e) => {
                    setVariableName(e.target.value);
                    updateNodeData({ variableName: e.target.value });
                  }}
                  className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
                />
                <p className="text-[10px] text-slate-400 px-1">Use this to save to a new variable.</p>
              </div>
            )}

            {/* Enter or paste value */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Enter or paste value</label>
              <Input 
                placeholder="Type value..." 
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  updateNodeData({ value: e.target.value });
                }}
                className="bg-white dark:bg-slate-900 border-none h-11 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus-visible:ring-[#00B074]/20 nodrag nopan"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

SetAttributeNode.displayName = 'SetAttributeNode';
