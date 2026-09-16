import { memo, useState, useCallback, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Copy, Trash2, X, MousePointerClick,
  Image as ImageIcon, List, ShoppingCart, ShoppingBag, Zap, User
} from 'lucide-react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from'sonner';
import { Button } from'@/components/ui/button';
import {
 DropdownMenu,
 DropdownMenuContent,
 DropdownMenuItem,
 DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from'@/lib/utils';
export const RequestInterventionNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [blocksCount] = useState(1);

  const fetchAgents = useCallback(() => {
    import('@/app/actions/agents').then(({ getAgents }) => {
      getAgents().then(res => setAvailableAgents(Array.isArray(res) ? res : [])).catch(console.error);
    });
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const updateNodeData = (newData: any) => {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...newData } } : node
      )
    );
  };

  const handleToggleAgent = (agentId: string) => {
    const agentIds = data.agentIds || [];
    const newAgentIds = agentIds.includes(agentId)
      ? agentIds.filter((id: string) => id !== agentId)
      : [...agentIds, agentId];
    updateNodeData({ agentIds: newAgentIds });
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
        "w-[340px] bg-white dark:bg-slate-900 rounded-[28px] shadow-xl border-2 border-transparent transition-all",
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
        <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[28px]">
          <div className="flex items-center">
            <div className="w-1.5 h-14 bg-[#00B074]" />
            <div className="flex items-center gap-3 px-4">
              <User className="w-5 h-5 text-[#00B074]" />
              <span className="font-bold text-[#00B074] tracking-tight">{tNodes("intervention")}</span>
            </div>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-5 space-y-4 pt-1">
          {/* Intervention Blocks Container */}
          <div className="bg-[#F2F0E9] dark:bg-slate-800/50 rounded-2xl p-3.5 space-y-3.5 border border-[#E5E2D9] dark:border-slate-800">
            {Array.from({ length: blocksCount }).map((_, index) => (
              <div key={index} className="bg-white dark:bg-slate-900 rounded-xl p-3 flex flex-col gap-3 shadow-sm border border-slate-100/50 dark:border-slate-800/50">
                <div className="flex items-center gap-4">
                  <div className="bg-[#00B074] rounded-lg p-2 shrink-0">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[15px] font-bold text-slate-900 dark:text-slate-100 leading-tight">{tNodes("requestIntervention")}</span>
                    <span className="text-[12px] text-slate-500 dark:text-slate-400 font-medium">Intervene users and talk</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="h-9 w-full bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 rounded-xl text-[12px] px-3 justify-start font-bold text-[#00B074] hover:text-[#00B074] hover:bg-white shadow-sm nodrag nopan">
                        <User className="w-3.5 h-3.5 mr-2 shrink-0" />
                        {data.agentIds?.length ? `${data.agentIds.length} agents assigned` : "Assign agents..."}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[260px] max-h-[300px] overflow-y-auto p-2 rounded-2xl shadow-xl border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                      <div className="px-2 py-1.5 mb-1 text-[13px] font-bold text-slate-500 uppercase tracking-wider">Available Agents</div>
                      {(availableAgents?.length || 0) === 0 ? (
                        <div className="p-4 text-center">
                          <div className="text-[12px] text-slate-500 italic mb-2">No agents found in your team.</div>
                          <Button variant="ghost" size="sm" className="text-[11px] text-emerald-600 font-bold h-7" onClick={() => window.open('/manage/agents', '_blank')}>Go to Team Settings</Button>
                        </div>
                      ) : (
                        availableAgents.map(agent => (
                          <div 
                            key={agent.id} 
                            className="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl cursor-pointer transition-colors group/agent" 
                            onClick={(e) => { e.stopPropagation(); handleToggleAgent(agent.id); }}
                          >
                            <div className={cn(
                              "w-4 h-4 rounded border-2 transition-all flex items-center justify-center shrink-0",
                              (data.agentIds || []).includes(agent.id) ? "bg-[#00B074] border-[#00B074]" : "border-slate-300 dark:border-slate-700"
                            )}>
                              {(data.agentIds || []).includes(agent.id) && (
                                <div className="w-1.5 h-1.5 bg-white rounded-full" />
                              )}
                            </div>
                            <div className="flex flex-col flex-1 truncate">
                              <span className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate group-hover/agent:text-[#00B074] transition-colors">{agent.name}</span>
                              <span className="text-[10px] text-slate-500 font-medium truncate uppercase tracking-tight">{agent.department?.name || 'Standard Agent'}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>




 </div>
 </div>
 </div>
 );
});

RequestInterventionNode.displayName ='RequestInterventionNode';
