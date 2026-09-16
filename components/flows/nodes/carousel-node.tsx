'use client';

import { memo, useState, useEffect, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from 'reactflow';
import { toast } from 'sonner';
import axios from 'axios';
import { Progress } from '@/components/ui/progress';
import { useTranslations } from 'next-intl';
import {
  Copy, Trash2, Image as ImageIcon, Plus, X,
  ChevronLeft, ChevronRight, Link2, Tag as TagIcon,
  User, Clock, Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { getTags, createTag } from '@/app/actions/tags';
import { getAgents } from '@/app/actions/agents';
import { CreateTagModal } from '@/components/flows/modals/create-tag-modal';

export const CarouselNode = memo(({ id, data, selected }: NodeProps) => {
  const tCommon = useTranslations("FlowEditor.common");
  const tNodes = useTranslations("FlowEditor.nodes");
  const { deleteElements, getNode, addNodes, setNodes } = useReactFlow();

  const [cards, setCards] = useState<any[]>(
    data.cards || [{ id: 'card-1', title: 'New Card', subtitle: '', image_url: '', buttons: [] }]
  );
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [availableTags, setAvailableTags] = useState<any[]>([]);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [activeTagButtonId, setActiveTagButtonId] = useState<string | null>(null);
  const platform = String(data.platform || '').toUpperCase();
  const carouselLabel = platform === 'FACEBOOK'
    ? 'Facebook Carousel'
    : platform === 'INSTAGRAM'
      ? 'Instagram Carousel'
      : 'Meta Carousel';

  const fetchTagsAndAgents = useCallback(() => {
    getTags().then(res => setAvailableTags(Array.isArray(res) ? res : [])).catch(console.error);
    getAgents().then(res => setAvailableAgents(Array.isArray(res) ? res : [])).catch(console.error);
  }, []);

  useEffect(() => { fetchTagsAndAgents(); }, [fetchTagsAndAgents]);

  const updateNodeData = (newData: any) => {
    setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...newData } } : n));
  };

  const updateCard = (index: number, field: string, value: any) => {
    const next = [...cards];
    next[index] = { ...next[index], [field]: value };
    setCards(next);
    updateNodeData({ cards: next });
  };

  const handleAddCard = () => {
    if (cards.length >= 10) { toast.error('Maximum 10 cards'); return; }
    const next = [...cards, { id: `card-${Date.now()}`, title: 'New Card', subtitle: '', image_url: '', buttons: [] }];
    setCards(next);
    updateNodeData({ cards: next });
    setActiveCardIndex(next.length - 1);
  };

  const handleRemoveCard = (index: number) => {
    if (cards.length <= 1) { toast.error('Need at least one card'); return; }
    const next = cards.filter((_, i) => i !== index);
    setCards(next);
    updateNodeData({ cards: next });
    setActiveCardIndex(Math.max(0, index - 1));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await axios.post('/api/upload', fd, {
        onUploadProgress: p => setUploadProgress(Math.round((p.loaded * 100) / (p.total || 1))),
      });
      if (res.data.url) {
        updateCard(activeCardIndex, 'image_url', res.data.url);
        toast.success('Image uploaded');
      } else {
        toast.error(res.data.error || 'Upload failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error uploading');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAddButton = (cardIndex: number) => {
    const card = cards[cardIndex];
    if (card.buttons.length >= 3) { toast.error('Max 3 buttons per card'); return; }
    const next = [...card.buttons, { id: `btn-${Date.now()}`, text: 'Button', url: '', tagIds: [], agentIds: [] }];
    updateCard(cardIndex, 'buttons', next);
  };

  const handleRemoveButton = (cardIndex: number, btnId: string) => {
    updateCard(cardIndex, 'buttons', cards[cardIndex].buttons.filter((b: any) => b.id !== btnId));
  };

  const handleButtonChange = (cardIndex: number, btnId: string, text: string) => {
    updateCard(cardIndex, 'buttons', cards[cardIndex].buttons.map((b: any) => b.id === btnId ? { ...b, text } : b));
  };

  const handleToggleTag = (cardIndex: number, btnId: string, tagId: string) => {
    const next = cards[cardIndex].buttons.map((b: any) => {
      if (b.id !== btnId) return b;
      const ids = b.tagIds || [];
      return { ...b, tagIds: ids.includes(tagId) ? ids.filter((i: string) => i !== tagId) : [...ids, tagId] };
    });
    updateCard(cardIndex, 'buttons', next);
  };

  const handleToggleAgent = (cardIndex: number, btnId: string, agentId: string) => {
    const next = cards[cardIndex].buttons.map((b: any) => {
      if (b.id !== btnId) return b;
      const ids = b.agentIds || [];
      return { ...b, agentIds: ids.includes(agentId) ? ids.filter((i: string) => i !== agentId) : [...ids, agentId] };
    });
    updateCard(cardIndex, 'buttons', next);
  };

  const handleCreateTag = async (tagData: { name: string; color: string }) => {
    try {
      const res: any = await createTag(tagData.name, tagData.color, undefined);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      const newTag = res.data;
      toast.success(`Tag "${tagData.name}" created`);
      setAvailableTags(prev => [...prev, newTag]);
      if (activeTagButtonId) handleToggleTag(activeCardIndex, activeTagButtonId, newTag.id);
      setActiveTagButtonId(null);
    } catch {
      toast.error('Failed to create tag');
    }
  };

  const handleDelete = () => deleteElements({ nodes: [{ id }] });

  const handleCopy = () => {
    const node = getNode(id);
    if (!node) return;
    addNodes({
      ...node,
      selected: false,
      dragging: false,
      id: `carousel-${Date.now()}`,
      position: { x: node.position.x + 50, y: node.position.y + 50 },
    });
    toast.success('Node duplicated');
  };

  const currentCard = cards[activeCardIndex];

  return (
    <>
      <CreateTagModal
        isOpen={isTagModalOpen}
        onClose={() => { setIsTagModalOpen(false); setActiveTagButtonId(null); }}
        onSubmit={handleCreateTag}
      />

      <div className={cn(
        'relative group/node w-[340px] bg-white dark:bg-slate-900 rounded-[32px] shadow-xl transition-all pb-2',
        selected ? 'ring-2 ring-emerald-500/40 shadow-emerald-500/10' : 'border border-slate-100 dark:border-slate-800'
      )}>

        {/* Top Menu */}
        {selected && (
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-2xl p-1.5 z-20 animate-in fade-in zoom-in nodrag nopan">
            <button onClick={handleCopy} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-slate-800 dark:text-slate-300 transition-colors">
              <Copy className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1" />
            <button onClick={handleDelete} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl text-slate-600 dark:text-slate-300 hover:text-red-500 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        )}

        <Handle
          type="target"
          position={Position.Left}
          className="w-2! h-full! bg-transparent! border-none! z-50! absolute! left-0! top-0! transform-none!"
          style={{ pointerEvents: 'all' }}
        />

        {/* Header */}
        <div className="bg-slate-100/50 dark:bg-slate-800/50 flex items-center border-b border-slate-100 dark:border-slate-800 overflow-hidden rounded-t-[22px]">
          <div className="w-1.5 h-14 bg-[#00B074]" />
          <div className="flex items-center gap-3 px-4">
            <ImageIcon className="w-5 h-5 text-[#00B074]" />
            <span className="font-bold text-[#00B074] tracking-tight text-[16px]">{carouselLabel}</span>
          </div>
        </div>

        {/* Card Navigation */}
        <div className="px-4 py-3 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="flex items-center gap-2">
            <button
              disabled={activeCardIndex === 0}
              onClick={() => setActiveCardIndex(p => p - 1)}
              className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Card {activeCardIndex + 1} of {cards.length}
            </span>
            <button
              disabled={activeCardIndex === cards.length - 1}
              onClick={() => setActiveCardIndex(p => p + 1)}
              className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded-md disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddCard}
              title="Add Card"
              className="p-1.5 bg-[#00B074]/10 text-[#00B074] rounded-lg hover:bg-[#00B074]/20 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleRemoveCard(activeCardIndex)}
              title="Remove Card"
              className="p-1.5 bg-red-500/10 text-red-600 rounded-lg hover:bg-red-500/20 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto max-h-[600px]">
          <div className="p-4 space-y-4">

            {/* Card Fields */}
            <div className="bg-[#EFECE5]/80 dark:bg-slate-800/80 rounded-2xl p-4 space-y-4 nodrag nopan">

              {/* Image Upload */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 px-1 uppercase tracking-wider">Card Image</label>
                <input
                  type="file"
                  id={`carousel-upload-${id}-${activeCardIndex}`}
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*"
                />
                <div
                  onClick={() => document.getElementById(`carousel-upload-${id}-${activeCardIndex}`)?.click()}
                  className={cn(
                    'bg-white dark:bg-slate-900 rounded-2xl h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 transition-all group/drop relative overflow-hidden',
                    isUploading && 'opacity-50 cursor-wait',
                    currentCard.image_url && 'border-[#00B074]/30'
                  )}
                >
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-2 w-full px-8">
                      <Loader2 className="w-6 h-6 text-[#00B074] animate-spin" />
                      <div className="w-full space-y-1">
                        <Progress value={uploadProgress} className="h-1 bg-slate-100" />
                        <p className="text-[9px] font-bold text-[#00B074] uppercase tracking-wider text-center">Uploading...</p>
                      </div>
                    </div>
                  ) : currentCard.image_url ? (
                    <div className="absolute inset-0 p-1">
                      <div className="w-full h-full rounded-xl overflow-hidden relative group/preview">
                        <img src={currentCard.image_url} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-[10px] font-bold uppercase">Change Image</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-[#00B074]/10 flex items-center justify-center mb-2 group-hover/drop:scale-110 transition-transform">
                        <ImageIcon className="w-5 h-5 text-[#00B074]" />
                      </div>
                      <span className="text-[10px] font-extrabold text-slate-600 dark:text-slate-400 uppercase">+ UPLOAD IMAGE</span>
                    </>
                  )}
                </div>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 px-1 uppercase tracking-wider">Card Title</label>
                <Input
                  className="bg-white dark:bg-slate-900 border-none h-10 rounded-xl text-sm shadow-sm font-bold focus-visible:ring-1 focus-visible:ring-slate-200"
                  placeholder="Card Title (max 80 chars)"
                  maxLength={80}
                  value={currentCard.title}
                  onChange={e => updateCard(activeCardIndex, 'title', e.target.value)}
                />
              </div>

              {/* Subtitle */}
              <div className="space-y-1.5">
                <label className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 px-1 uppercase tracking-wider">Subtitle (Optional)</label>
                <Textarea
                  className="bg-white dark:bg-slate-900 border-none rounded-xl text-sm shadow-sm resize-none min-h-[60px] focus-visible:ring-1 focus-visible:ring-slate-200"
                  placeholder="Card Subtitle (max 80 chars)"
                  maxLength={80}
                  value={currentCard.subtitle}
                  onChange={e => updateCard(activeCardIndex, 'subtitle', e.target.value)}
                />
              </div>

              {/* Buttons */}
              <div className="space-y-2">
                <label className="text-[12px] font-semibold text-slate-600 dark:text-slate-300 px-1 uppercase tracking-wider">Buttons (Max 3)</label>

                {currentCard.buttons.map((btn: any) => (
                  <div key={btn.id} className="space-y-2 group/btn nodrag nopan">

                    {/* Button text row */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 flex items-center justify-between shadow-sm">
                        <Input
                          className="border-none h-6 p-0 text-sm focus-visible:ring-0 bg-transparent font-medium"
                          value={btn.text}
                          onChange={e => handleButtonChange(activeCardIndex, btn.id, e.target.value)}
                          placeholder="Button text"
                        />
                        <button
                          onClick={() => handleRemoveButton(activeCardIndex, btn.id)}
                          className="opacity-0 group-hover/btn:opacity-100 p-1 text-red-500 transition-all hover:bg-red-50 rounded-md"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <Handle
                        type="source"
                        position={Position.Right}
                        id={`${currentCard.id}_${btn.id}`}
                        className="w-3! h-3! border-2! border-[#00B074]! bg-white! rounded-full! absolute! -right-2! top-5! z-50!"
                      />
                    </div>

                    {/* URL + Tags + Agents */}
                    <div className="flex flex-col gap-2 px-1 pb-2 border-b border-slate-200 dark:border-slate-700 last:border-0">

                      {/* URL */}
                      <div className="flex items-center gap-2">
                        <Link2 className="w-3 h-3 text-slate-400" />
                        <Input
                          className="h-7 bg-white dark:bg-slate-900 text-[10px] rounded-lg border-slate-200 focus-visible:ring-1 focus-visible:ring-[#00B074]/20"
                          placeholder="URL (optional)"
                          value={btn.url || ''}
                          onChange={e => {
                            const next = currentCard.buttons.map((b: any) => b.id === btn.id ? { ...b, url: e.target.value } : b);
                            updateCard(activeCardIndex, 'buttons', next);
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">

                        {/* Tags */}
                        <div className="flex items-center gap-1.5">
                          <TagIcon className="w-3 h-3 text-slate-400 shrink-0" />
                          <DropdownMenu onOpenChange={open => { if (open) fetchTagsAndAgents(); }}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="h-7 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg text-[9px] px-2 justify-start font-medium text-slate-500 hover:text-slate-700 truncate">
                                {btn.tagIds?.length ? `${btn.tagIds.length} tags` : 'Tags...'}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[180px] max-h-[250px] overflow-y-auto">
                              <DropdownMenuItem
                                className="p-2 border-b border-slate-100 dark:border-slate-800 mb-1 sticky top-0 bg-white dark:bg-slate-900 z-10 focus:bg-emerald-50"
                                onSelect={() => { setActiveTagButtonId(btn.id); setIsTagModalOpen(true); }}
                              >
                                <div className="flex items-center gap-2 text-emerald-600 font-medium text-[10px] w-full cursor-pointer">
                                  <Plus className="w-3 h-3" />
                                  Create New Tag
                                </div>
                              </DropdownMenuItem>
                              {availableTags.length === 0 ? (
                                <div className="p-2 text-[10px] text-slate-500 italic">No tags found.</div>
                              ) : availableTags.map(tag => (
                                <div
                                  key={tag.id}
                                  className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer"
                                  onClick={e => { e.stopPropagation(); handleToggleTag(activeCardIndex, btn.id, tag.id); }}
                                >
                                  <Checkbox checked={(btn.tagIds || []).includes(tag.id)} onCheckedChange={() => handleToggleTag(activeCardIndex, btn.id, tag.id)} />
                                  <span className="text-[11px] flex-1 truncate">{tag.name}</span>
                                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color || '#10B981' }} />
                                </div>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Agents */}
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <DropdownMenu onOpenChange={open => { if (open) fetchTagsAndAgents(); }}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="h-7 w-full bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-lg text-[9px] px-2 justify-start font-medium text-slate-500 hover:text-slate-700 truncate">
                                {btn.agentIds?.length ? `${btn.agentIds.length} agents` : 'Agents...'}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-[180px] max-h-[250px] overflow-y-auto">
                              {availableAgents.length === 0 ? (
                                <div className="p-2 text-[10px] text-slate-500 italic">No agents found.</div>
                              ) : availableAgents.map(agent => (
                                <div
                                  key={agent.id}
                                  className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer"
                                  onClick={e => { e.stopPropagation(); handleToggleAgent(activeCardIndex, btn.id, agent.id); }}
                                >
                                  <Checkbox checked={(btn.agentIds || []).includes(agent.id)} onCheckedChange={() => handleToggleAgent(activeCardIndex, btn.id, agent.id)} />
                                  <div className="flex flex-col flex-1 truncate">
                                    <span className="text-[11px] font-medium truncate">{agent.name}</span>
                                    <span className="text-[9px] text-slate-500 truncate">{agent.department?.name || 'No Dept'}</span>
                                  </div>
                                </div>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                      </div>
                    </div>
                  </div>
                ))}

                {currentCard.buttons.length < 3 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddButton(activeCardIndex)}
                    className="w-full h-8 rounded-xl text-xs border-dashed border-slate-300 text-slate-500 hover:text-[#00B074] hover:border-[#00B074] transition-all"
                  >
                    <Plus className="w-3 h-3 mr-2" /> Add Button
                  </Button>
                )}
              </div>

            </div>{/* end card fields */}

            {/* Wait Delay */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl p-3 flex items-center justify-between nodrag nopan">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span className="text-[11px] text-slate-500 font-medium uppercase tracking-tight">Wait Delay (s)</span>
              </div>
              <Input
                className="w-20 h-8 text-[11px] bg-white dark:bg-slate-900 text-center rounded-lg border-slate-200 focus-visible:ring-1 focus-visible:ring-[#00B074]/20 font-bold"
                placeholder="0.0"
                value={data.delay || ''}
                onChange={e => updateNodeData({ delay: e.target.value })}
              />
            </div>

            {/* Connect Next */}
            <div className="bg-white dark:bg-slate-900 border border-[#00B074]/20 rounded-2xl h-[44px] flex items-center justify-center relative transition-all shadow-sm nodrag nopan">
              <span className="text-[#00B074] text-[14px] font-medium tracking-tight">Connect Next</span>
              <Handle
                type="source"
                position={Position.Right}
                id="right"
                className="w-4! h-4! border-[3px]! border-[#00B074]! bg-white! rounded-full! absolute! right-2! top-1/2! -translate-y-1/2! z-50!"
              />
            </div>

          </div>
        </div>

      </div>
    </>
  );
});

CarouselNode.displayName = 'CarouselNode';
