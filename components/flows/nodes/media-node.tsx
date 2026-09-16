import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import axios from 'axios';
import { Progress } from '@/components/ui/progress';
import { useTranslations } from 'next-intl';
import {
    Zap,
    User,
    ChevronUp,
    Plus,
    Copy,
    Trash2,
    Image as ImageIcon,
    X,
    Loader2,
    MousePointerClick,
    List,
    ShoppingCart,
    ShoppingBag,
    MessageSquare,
    Link2,
    Tag as TagIcon,
    Music,
    FileText,
    Video,
    CheckCircle2,
    Sparkles
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MediaLibraryModal } from '@/components/flows/modals/media-library-modal';
import { cn } from '@/lib/utils';
import { getTags, createTag } from '@/app/actions/tags';
import { getAgents } from '@/app/actions/agents';
import { CreateTagModal } from '@/components/flows/modals/create-tag-modal';

export const MediaNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
    const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();
    const [isUploading, setIsUploading] = useState(false);
    const [isLibraryOpen, setIsLibraryOpen] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [contentType, setContentType] = useState(data.contentType || 'image');
    const [fileUrl, setFileUrl] = useState(data.fileUrl || '');
    const [message, setMessage] = useState(data.message || '');
    const [buttons, setButtons] = useState<any[]>(data.buttons || []);
    const [delay, setDelay] = useState(data.delay || '');
    const [timeoutEnabled, setTimeoutEnabled] = useState(data.timeoutEnabled || false);
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
        const newButtons = [...buttons, { id: `btn-${Date.now()}`, text: 'New Button', url: '' }];
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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post('/api/upload', formData, {
                onUploadProgress: (progressEvent) => {
                    const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1))
                    setUploadProgress(percentCompleted)
                }
            });
            
            const result = response.data;
            if (result.url) {
                const fileType = file.type || '';
                let detectedType = contentType;
                if (fileType.startsWith('image/')) detectedType = 'image';
                else if (fileType.startsWith('video/')) detectedType = 'video';
                else if (fileType.startsWith('audio/')) detectedType = 'audio';
                else if (fileType.length > 0) detectedType = 'document';

                setFileUrl(result.url);
                setContentType(detectedType);
                updateNodeData({ fileUrl: result.url, contentType: detectedType });
                toast.success("Media uploaded successfully");
            } else {
                toast.error(result.error || "Upload failed");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Error uploading file");
        } finally {
            setIsUploading(false);
            setUploadProgress(0);
        }
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
        { label: 'First Name', value: '{{customer.firstName}}' },
        { label: 'Last Name', value: '{{customer.lastName}}' },
        { label: 'Email', value: '{{customer.email}}' },
        { label: 'Shop Name', value: '{{shop.name}}' },
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
                    selected ? "border-indigo-500 shadow-indigo-500/10 ring-4 ring-indigo-500/10" : 
                    data.isHoveredDuringConnect ? "border-indigo-400 animate-pulse" :
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
                        <div className="w-1.5 h-16 bg-indigo-500" />
                        <div className="flex items-center gap-4 px-6 py-4">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-indigo-500" />
                            </div>
                            <span className="font-bold text-xl text-indigo-600 dark:text-indigo-400 tracking-tight">{tNodes("mediaMessage")}</span>
                        </div>
                    </div>

                    {/* Content Container */}
                    <div className="p-6 space-y-6">
                        <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-5 nodrag nopan">
                            {/* Media Type Select */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">Content Type</label>
                                <Select
                                    value={contentType}
                                    onValueChange={(val) => {
                                        setContentType(val);
                                        updateNodeData({ contentType: val });
                                    }}
                                >
                                    <SelectTrigger className="w-full bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 text-slate-700 dark:text-slate-200 font-bold rounded-xl shadow-sm focus:ring-indigo-500/20 px-4">
                                        <SelectValue placeholder="Select media type" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-2xl">
                                        <SelectItem value="image">Image</SelectItem>
                                        <SelectItem value="video">Video</SelectItem>
                                        <SelectItem value="audio">Audio / Voice</SelectItem>
                                        <SelectItem value="document">Document</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Dropzone */}
                            <input
                                type="file"
                                id={`file-upload-${id}`}
                                className="hidden"
                                onChange={handleFileUpload}
                                accept={
                                    contentType === 'image' ? 'image/*' : 
                                    contentType === 'video' ? 'video/*' : 
                                    contentType === 'audio' ? 'audio/*' : 
                                    '*/*'
                                }
                            />
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsLibraryOpen(true);
                                }}
                                onPointerDown={(e) => e.stopPropagation()}
                                className={cn(
                                    "bg-white dark:bg-slate-900 rounded-[24px] h-44 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group/drop relative overflow-hidden",
                                    isUploading && "opacity-50 cursor-wait",
                                    fileUrl && "border-indigo-500/30"
                                )}
                            >
                                {isUploading ? (
                                    <div className="flex flex-col items-center gap-4 w-full px-10">
                                        <div className="relative">
                                            <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                        </div>
                                        <div className="w-full space-y-2">
                                            <Progress value={uploadProgress} className="h-1.5 bg-slate-100" indicatorClassName="bg-indigo-500" />
                                            <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-[0.2em] text-center">{uploadProgress}% Uploaded</p>
                                        </div>
                                    </div>
                                ) : fileUrl ? (
                                    <div className="absolute inset-0 p-3">
                                        {contentType === 'image' ? (
                                            <div className="w-full h-full rounded-2xl overflow-hidden relative group/preview shadow-lg">
                                                <img src={fileUrl} alt="Preview" className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover/preview:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[2px]">
                                                    <ImageIcon className="w-8 h-8 text-white mb-2" />
                                                    <span className="text-white text-[10px] font-bold uppercase tracking-widest">Change Image</span>
                                                </div>
                                            </div>
                                        ) : contentType === 'video' ? (
                                            <div className="w-full h-full rounded-2xl overflow-hidden relative group/preview shadow-lg bg-slate-900">
                                                <video src={fileUrl} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover/preview:opacity-100 transition-all flex flex-col items-center justify-center backdrop-blur-[2px]">
                                                    <Video className="w-8 h-8 text-white mb-2" />
                                                    <span className="text-white text-[10px] font-bold uppercase tracking-widest">Change Video</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-800 rounded-2xl relative group/preview border border-slate-100 p-2 text-center">
                                                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mb-2 shrink-0">
                                                    {contentType === 'audio' ? <Music className="w-6 h-6 text-indigo-500" /> : <FileText className="w-6 h-6 text-indigo-500" />}
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[200px] px-2 uppercase tracking-tight">
                                                    {fileUrl.split('/').pop()?.substring(0, 25) || `${contentType} Attached`}
                                                </span>
                                                <div className="absolute inset-0 bg-indigo-600/60 opacity-0 group-hover/preview:opacity-100 transition-all flex items-center justify-center rounded-2xl">
                                                    <span className="text-white font-bold text-[10px] uppercase tracking-widest bg-indigo-600 px-3 py-1.5 rounded-lg shadow-sm">Change {contentType}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <>
                                        <div className="w-14 h-14 rounded-[20px] bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center mb-4 group-hover/drop:scale-110 group-hover/drop:bg-indigo-100 transition-all shadow-sm">
                                            {contentType === 'image' && <ImageIcon className="w-7 h-7 text-indigo-500" />}
                                            {contentType === 'video' && <Video className="w-7 h-7 text-indigo-500" />}
                                            {contentType === 'audio' && <Music className="w-7 h-7 text-indigo-500" />}
                                            {contentType === 'document' && <FileText className="w-7 h-7 text-indigo-500" />}
                                        </div>
                                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 tracking-[0.2em] uppercase">Add {contentType}</span>
                                        <span className="text-[9px] font-bold text-slate-400 mt-2 uppercase">Max size 25MB</span>
                                    </>
                                )}
                            </div>

                            {/* Caption Input */}
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 block">Caption</label>
                                    <span className="text-[10px] text-slate-400 font-mono font-bold uppercase">{message.length}/1024</span>
                                </div>
                                <div className="border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 p-3 relative shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                                    <Textarea
                                        id={`textarea-${id}`}
                                        placeholder="Add a caption..."
                                        value={message}
                                        onChange={(e) => {
                                            setMessage(e.target.value);
                                            updateNodeData({ message: e.target.value });
                                        }}
                                        className="border-none shadow-none resize-none px-1 py-1 min-h-[100px] text-[14px] text-slate-700 dark:text-slate-200 bg-transparent focus-visible:ring-0 placeholder:text-slate-400 font-bold leading-relaxed"
                                    />
                                    <div className="flex justify-between items-center mt-2">
                                        {data.platform === 'SHOPIFY' ? (
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="h-7 px-3 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:hover:bg-indigo-500/10 gap-2 uppercase tracking-widest rounded-xl">
                                                        <Sparkles className="w-3.5 h-3.5" /> Variables
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="start" className="w-56 bg-white dark:bg-slate-900 border-none shadow-2xl rounded-2xl p-2">
                                                    <div className="px-3 py-2 border-b border-slate-50 mb-1">
                                                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Order Variables</span>
                                                    </div>
                                                    {SHOPIFY_VARIABLES.map((v) => (
                                                        <DropdownMenuItem 
                                                            key={v.value} 
                                                            onClick={() => insertVariable(v.value)}
                                                            className="text-xs py-2.5 px-3 rounded-xl cursor-pointer hover:bg-indigo-50 text-slate-700 flex flex-col items-start gap-0.5"
                                                        >
                                                            <span className="font-bold">{v.label}</span>
                                                            <span className="text-[10px] text-slate-400 font-mono tracking-tighter">{v.value}</span>
                                                        </DropdownMenuItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        ) : <div />}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Buttons mapping */}
                        <div className="space-y-4">
                            {buttons.map((btn) => (
                                <div key={btn.id} className="relative group/btn animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="bg-slate-50/80 dark:bg-slate-800/40 rounded-[24px] p-5 border border-slate-100/50 dark:border-slate-700/50 space-y-4 hover:border-indigo-400/50 transition-all">
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-4 py-2.5 shadow-sm flex items-center justify-between">
                                                <Input
                                                    className="border-none h-6 p-0 text-sm focus-visible:ring-0 bg-transparent font-bold text-slate-700 dark:text-slate-200"
                                                    value={btn.text}
                                                    onChange={(e) => handleButtonChange(btn.id, e.target.value)}
                                                    placeholder="Button Label"
                                                />
                                                <button
                                                    onClick={() => handleRemoveButton(btn.id)}
                                                    className="opacity-0 group-hover/btn:opacity-100 p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="space-y-3 px-1">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm shrink-0">
                                                    <Link2 className="w-4 h-4 text-indigo-500" />
                                                </div>
                                                <Input
                                                    className="h-9 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-xl text-[11px] px-3 focus:ring-indigo-500/20 font-bold w-full text-indigo-600 placeholder:text-slate-300 shadow-sm"
                                                    value={btn.url || ''}
                                                    onChange={(e) => {
                                                        const newButtons = buttons.map(b => 
                                                            b.id === btn.id ? { ...b, url: e.target.value } : b
                                                        );
                                                        setButtons(newButtons);
                                                        updateNodeData({ buttons: newButtons });
                                                    }}
                                                    placeholder="Redirect URL (Optional)"
                                                />
                                            </div>

                                            <div className="flex gap-2">
                                                <DropdownMenu onOpenChange={(open) => { if (open) fetchTagsAndAgents(); }}>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="h-9 flex-1 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] px-3 justify-start font-bold text-slate-500 hover:text-indigo-600 shadow-sm">
                                                            <TagIcon className="w-3.5 h-3.5 mr-2 shrink-0 opacity-50" />
                                                            {btn.tagIds?.length ? `${btn.tagIds.length} Tags` : "Add Tags"}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto rounded-2xl shadow-2xl border-none p-2">
                                                        <DropdownMenuItem 
                                                            className="p-2.5 border-b border-slate-50 mb-2 sticky top-0 bg-white z-10 focus:bg-indigo-50 rounded-xl"
                                                            onSelect={() => {
                                                                setActiveTagButtonId(btn.id);
                                                                setIsTagModalOpen(true);
                                                            }}
                                                        >
                                                            <div className="flex items-center gap-3 text-indigo-600 font-bold text-[11px] w-full cursor-pointer uppercase tracking-widest">
                                                                <Plus className="w-4 h-4" />
                                                                Create Tag
                                                            </div>
                                                        </DropdownMenuItem>
                                                        {(availableTags?.length || 0) === 0 ? (
                                                            <div className="p-4 text-[10px] text-slate-400 italic text-center font-bold">No tags available</div>
                                                        ) : (
                                                            <div className="grid gap-1">
                                                                {availableTags.map(tag => (
                                                                    <div key={tag.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); handleToggleTag(btn.id, tag.id); }}>
                                                                        <Checkbox checked={(btn.tagIds || []).includes(tag.id)} onCheckedChange={() => handleToggleTag(btn.id, tag.id)} className="border-slate-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600" />
                                                                        <span className="text-[12px] font-bold flex-1 truncate text-slate-700">{tag.name}</span>
                                                                        <div className="w-2.5 h-2.5 rounded-full ring-2 ring-offset-2 ring-slate-100" style={{ backgroundColor: tag.color || '#6366f1' }} />
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </DropdownMenuContent>
                                                </DropdownMenu>

                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" className="h-9 flex-1 bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-xl text-[10px] px-3 justify-start font-bold text-slate-500 hover:text-indigo-600 shadow-sm">
                                                            <User className="w-3.5 h-3.5 mr-2 shrink-0 opacity-50" />
                                                            {btn.agentIds?.length ? `${btn.agentIds.length} Agents` : "Assign"}
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start" className="w-[220px] max-h-[300px] overflow-y-auto rounded-2xl shadow-2xl border-none p-2">
                                                        <div className="px-3 py-2 border-b border-slate-50 mb-2">
                                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Team Members</span>
                                                        </div>
                                                        {(availableAgents?.length || 0) === 0 ? (
                                                            <div className="p-4 text-[10px] text-slate-400 italic text-center font-bold">No agents found</div>
                                                        ) : (
                                                            <div className="grid gap-1">
                                                                {availableAgents.map(agent => (
                                                                    <div key={agent.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors" onClick={(e) => { e.stopPropagation(); handleToggleAgent(btn.id, agent.id); }}>
                                                                        <Checkbox checked={(btn.agentIds || []).includes(agent.id)} onCheckedChange={() => handleToggleAgent(btn.id, agent.id)} className="border-slate-200 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600" />
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
                                    <Handle
                                        type="source"
                                        position={Position.Right}
                                        id={btn.id}
                                        className="w-5! h-5! border-[3px]! border-white! bg-indigo-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50 transition-all hover:scale-125 cursor-crosshair shadow-lg"
                                        style={{ pointerEvents: 'all' }}
                                    />
                                </div>
                            ))}

                            {buttons.length < (data.platform?.includes('INSTAGRAM') ? 13 : 3) && (
                                <Button
                                    variant="outline"
                                    onClick={handleAddButton}
                                    className="w-full bg-white dark:bg-slate-900 border-2 border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 justify-center h-12 rounded-2xl shadow-sm text-xs font-bold uppercase tracking-widest transition-all hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50/50 nodrag nopan"
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
                                        placeholder="e.g. 1.0"
                                        value={delay}
                                        onChange={(e) => {
                                            setDelay(e.target.value);
                                            updateNodeData({ delay: e.target.value });
                                        }}
                                        className="bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 h-11 rounded-xl text-sm font-bold shadow-sm focus:ring-indigo-500/20 px-4"
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
                                        className="data-[state=checked]:bg-indigo-600"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Add Content Button */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="w-full bg-indigo-600 text-white border-none justify-center h-12 rounded-2xl shadow-lg shadow-indigo-600/20 text-xs font-bold uppercase tracking-[0.2em] transition-all hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 nodrag nopan"
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

                        {/* Connect Node (Standard Output) */}
                        <div className="relative group/connect cursor-crosshair">
                            <div className="bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl h-14 flex items-center justify-center group-hover/connect:border-indigo-400 transition-all">
                                <span className="text-slate-400 text-xs font-bold uppercase tracking-widest group-hover/connect:text-indigo-500 transition-colors">{tCommon("connectNode")}</span>
                            </div>
                            <Handle
                                type="source"
                                position={Position.Right}
                                id="right"
                                className="w-5! h-5! border-[3px]! border-white! bg-indigo-500! rounded-full! absolute! -right-2.5! top-1/2! -translate-y-1/2! z-50! cursor-crosshair! shadow-lg"
                                style={{ pointerEvents: 'all' }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <MediaLibraryModal
                isOpen={isLibraryOpen}
                onClose={() => setIsLibraryOpen(false)}
                onSelect={(url, name, type) => {
                    setFileUrl(url);
                    const resolvedType = (type === 'gif' ? 'image' : type) || contentType;
                    setContentType(resolvedType);
                    updateNodeData({ fileUrl: url, contentType: resolvedType });
                }}
                contentType={contentType as any}
            />
        </>
    );
});

MediaNode.displayName = 'MediaNode';
