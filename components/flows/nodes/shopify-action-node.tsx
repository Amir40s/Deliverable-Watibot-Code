import { memo } from "react";
import { Handle, Position, NodeProps, useReactFlow } from "reactflow";
import { useTranslations } from 'next-intl';
import {
  Zap,
  Tag,
  Truck,
  CreditCard,
  Package,
  Copy,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
export const ShopifyActionNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { deleteElements, getNode, addNodes } = useReactFlow();
  const handleDelete = () => {
    deleteElements({ nodes: [{ id }] });
    toast.success("Node deleted");
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
      {selected && (
        <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-1.5 z-20 animate-in fade-in zoom-in slide-in-from-bottom-2 nodrag nopan">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-300 transition-colors"
            title="Duplicate"
          >
            <Copy className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
            className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl text-red-600 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      <div
        className={cn(
          "relative w-[280px] bg-white dark:bg-slate-900 rounded-[24px] border-[6px] transition-all shadow-xl",
          selected
            ? "border-emerald-600 ring-4 ring-emerald-500/20"
            : "border-emerald-100 dark:border-slate-800",
        )}
      >
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-none">
                Shopify Action
              </h4>
              <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-wider">
                Execute Task
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: Tag, label: "Discount" },
              { icon: Truck, label: "Fulfill" },
              { icon: CreditCard, label: "Refund" },
              { icon: Package, label: "Stock" },
            ].map((item, idx) => (
              <div
                key={idx}
                className="p-2 border border-gray-100 dark:border-slate-800 rounded-xl flex flex-col items-center gap-1 bg-slate-50/50 dark:bg-slate-800/30"
              >
                <item.icon className="w-4 h-4 text-gray-400" />
                <span className="text-[9px] font-bold text-gray-500 uppercase">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <Handle
          type="target"
          position={Position.Left}
          className="w-3! h-3! border-[3px]! border-emerald-600! bg-white! rounded-full!"
        />
        <Handle
          type="source"
          position={Position.Right}
          className="w-3! h-3! border-[3px]! border-emerald-600! bg-white! rounded-full!"
        />
      </div>
    </div>
  );
});
ShopifyActionNode.displayName = "ShopifyActionNode";
