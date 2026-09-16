import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import { MessageSquareText, Copy, Trash2, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getTags } from '@/app/actions/tags';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

export const AddTagNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { setNodes, deleteElements, getNode, addNodes } = useReactFlow();
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tagIds = data.tagIds || [];

  useEffect(() => {
    getTags()
      .then(tags => {
        setAvailableTags(tags);
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

  const handleTagChange = (index: number, value: string) => {
    const nextTagIds = [...tagIds];
    nextTagIds[index] = value;
    updateNodeData({ tagIds: nextTagIds });
  };

  const addTag = () => {
    updateNodeData({ tagIds: [...tagIds, ""] });
  };

  const removeTag = (index: number) => {
    const nextTagIds = tagIds.filter((_: any, i: number) => i !== index);
    updateNodeData({ tagIds: nextTagIds });
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
      id: `${node.type}-${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
    });
    toast.success(tCommon("nodeDuplicated"));
  };

  return (
    <>
      <div className="relative group/node">
        {selected && (
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-1.5 z-20 animate-in fade-in zoom-in slide-in-from-bottom-2 nodrag nopan">
            <button onClick={(e) => { e.stopPropagation(); handleCopy(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-300 transition-colors">
              <Copy className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button onClick={(e) => { e.stopPropagation(); handleDelete(); }} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className={cn(
          "w-[340px] bg-white dark:bg-slate-900 rounded-[24px] shadow-lg transition-all focus:outline-none",
          selected ? "ring-2 ring-emerald-500/40 shadow-emerald-500/10" : "border border-slate-100 dark:border-slate-800"
        )}>
          <Handle type="target" position={Position.Left} className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!" style={{ pointerEvents: 'all' }} />

          <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px] relative">
            <div className="flex items-center">
              <div className="w-1.5 h-14 bg-[#00B074]" />
              <div className="flex items-center gap-3 px-4">
                <MessageSquareText className="w-5 h-5 text-[#00B074]" />
                <span className="font-bold text-[#00B074] tracking-tight text-[15px]">{tNodes("addTag")}</span>
              </div>
            </div>
            <Handle type="source" position={Position.Right} id="right" className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! dark:bg-slate-900! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50! cursor-crosshair!" style={{ pointerEvents: 'all' }} />
          </div>

          <div className="p-4 space-y-3">
            <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-3">
              {tagIds.map((currentTagId: string, index: number) => (
                <div key={index} className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300 px-1 tracking-tight">Select Tag</label>
                    <button onClick={() => removeTag(index)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-full hover:bg-slate-200/50 p-0.5 nodrag nopan">
                      <X className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                  <div className="relative">
                    <Select value={currentTagId} onValueChange={(val) => handleTagChange(index, val)}>
                      <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-none h-11 pl-9 text-slate-700 dark:text-slate-200 font-medium rounded-xl shadow-sm focus:ring-[#00B074]/20 transition-all text-left nodrag nopan">
                        <div className="flex items-center gap-2">
                          {currentTagId && (
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: availableTags.find(t => t.id === currentTagId)?.color || '#10B981' }} />
                          )}
                          <SelectValue placeholder="Select tag" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-h-[200px] overflow-y-auto">
                        {availableTags.map(tag => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color || '#10B981' }} />
                              <span className="truncate">{tag.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <span className="text-sm font-bold">@</span>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addTag} className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl h-11 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm text-slate-700 dark:text-slate-200 text-sm font-medium nodrag nopan">
                + Add Tag
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
});

AddTagNode.displayName = 'AddTagNode';
