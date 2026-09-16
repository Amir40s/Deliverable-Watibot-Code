import { memo, useState, useEffect } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { MessageSquare, Trash2, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { useTranslations } from 'next-intl';

export const PublicReplyNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
    const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
    const [message, setMessage] = useState(data.message || '');

    useEffect(() => {
        setMessage(data.message || '');
    }, [data.message]);

    const updateNodeData = (val: string) => {
        setMessage(val);
        setNodes((nds) =>
            nds.map((node) =>
                node.id === id ? { ...node, data: { ...node.data, message: val } } : node
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
            id: `public_reply_${Date.now()}`,
            position: { x: node.position.x + 50, y: node.position.y + 50 },
            selected: false,
        });
        toast.success(tCommon("nodeDuplicated"));
    };

    return (
        <div className={cn(
            "relative group/node w-[300px] bg-white dark:bg-slate-900 rounded-[24px] shadow-lg transition-all pb-1.5",
            selected ? "ring-2 ring-blue-500/40 shadow-blue-500/10" : "border border-slate-100 dark:border-slate-800"
        )}>
            {/* Top Menu */}
            {selected && (
                <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-1.5 z-20 animate-in fade-in zoom-in nodrag nopan">
                    <button onClick={handleCopy} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-300">
                        <Copy className="w-5 h-5" />
                    </button>
                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
                    <button onClick={handleDelete} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-red-500">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            )}

            {/* Handle Target */}
            <Handle type="target" position={Position.Left} className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!" />

            {/* Header */}
            <div className="bg-slate-50 dark:bg-slate-800/50 flex items-center border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px]">
                <div className="w-1.5 h-12 bg-blue-500" />
                <div className="flex items-center gap-3 px-4">
                    <MessageSquare className="w-4 h-4 text-blue-500" />
                    <span className="font-bold text-blue-500 tracking-tight text-[14px] uppercase">{tNodes("publicReply")}</span>
                </div>
            </div>

            {/* Content Container */}
            <div className="p-4 space-y-3">
                <div className="bg-blue-50/30 dark:bg-blue-900/10 rounded-2xl p-3 space-y-2">
                    <p className="text-[10px] text-blue-500/70 uppercase font-bold tracking-widest px-1">Public Response Text</p>
                    
                    <div className="border border-blue-200/50 dark:border-blue-500/20 rounded-xl bg-white dark:bg-slate-900 p-1 relative shadow-sm nodrag nopan focus-within:ring-1 focus-within:ring-blue-400">
                        <Textarea
                            placeholder="Type public reply..."
                            value={message}
                            onChange={(e) => updateNodeData(e.target.value)}
                            className="border-none shadow-none resize-none px-2 py-1 min-h-[80px] text-[14px] text-slate-700 dark:text-slate-200 bg-transparent focus-visible:ring-0 placeholder:text-slate-400 transition-all font-medium"
                        />
                    </div>
                </div>
            </div>

            {/* Handle Source */}
            <Handle 
                type="source" 
                position={Position.Right} 
                className="w-4! h-4! border-[3px]! border-blue-500! bg-white! dark:bg-slate-800! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50!" 
            />
        </div>
    );
});

PublicReplyNode.displayName = 'PublicReplyNode';
