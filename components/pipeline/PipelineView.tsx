'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  useDroppable,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
  GitCommitHorizontal,
  Plus,
  Search,
  Tag as TagIcon,
  User as UserIcon,
  Users,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from 'sonner';
import {
  getPipelineBoardData,
  moveContactStage,
  reorderPipelineStages,
} from '@/app/actions/pipeline';
import { PipelineColumn, type PipelineStageData } from './PipelineColumn';
import { PipelineCard, PipelineCardOverlay, type PipelineContact } from './PipelineCard';
import { StageModal } from './StageModal';
import { DeleteStageModal } from './DeleteStageModal';
import { ContactChatDrawer } from '@/components/contacts/ContactChatDrawer';
import { ContactProfileDrawer } from '@/components/contacts/ContactProfileDrawer';
import { cn } from '@/lib/utils';

function UnassignedLeadsPanel({
  leads,
  onOpenChat,
  onOpenProfile,
}: {
  leads: PipelineContact[];
  onOpenChat: (contact: PipelineContact) => void;
  onOpenProfile: (contact: PipelineContact) => void;
}) {
  const leadIds = leads.map((lead) => lead.id);
  const { setNodeRef, isOver } = useDroppable({
    id: 'column-unassigned',
    data: { type: 'column', stageId: 'unassigned' },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex-1 overflow-y-auto py-4 space-y-3 scrollbar-thin rounded-xl transition-colors',
        isOver && 'bg-emerald-50/50 dark:bg-emerald-950/20 ring-2 ring-emerald-500/40 ring-inset'
      )}
    >
      <SortableContext items={leadIds} strategy={verticalListSortingStrategy}>
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center text-slate-400">
            <Sparkles className="w-8 h-8 text-emerald-500/40 mb-2" />
            <p className="font-medium text-xs">All leads are assigned to pipeline stages!</p>
          </div>
        ) : (
          leads.map((contact) => (
            <PipelineCard
              key={contact.id}
              contact={contact}
              stageId="unassigned"
              onOpenChat={onOpenChat}
              onOpenProfile={onOpenProfile}
            />
          ))
        )}
      </SortableContext>
    </div>
  );
}

export function PipelineView() {
  const [pipelineData, setPipelineData] = useState<{
    id: string;
    name: string;
    description: string | null;
  } | null>(null);
  const [stages, setStages] = useState<PipelineStageData[]>([]);
  const [unassignedLeads, setUnassignedLeads] = useState<PipelineContact[]>([]);
  const [totalLeadsCount, setTotalLeadsCount] = useState<number>(0);
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color?: string | null }>>([]);
  const [availableAgents, setAvailableAgents] = useState<Array<{ id: string; name: string | null; email: string }>>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters
  const [search, setSearch] = useState<string>('');
  const [selectedTagId, setSelectedTagId] = useState<string>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('all');

  // Modals & Drawers
  const [isStageModalOpen, setIsStageModalOpen] = useState<boolean>(false);
  const [editingStage, setEditingStage] = useState<PipelineStageData | null>(null);
  const [deletingStage, setDeletingStage] = useState<PipelineStageData | null>(null);
  const [isUnassignedOpen, setIsUnassignedOpen] = useState<boolean>(false);

  // Contact Drawers
  const [chatContact, setChatContact] = useState<PipelineContact | null>(null);
  const [profileContact, setProfileContact] = useState<PipelineContact | null>(null);

  const [activeDragContact, setActiveDragContact] = useState<PipelineContact | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const customCollisionStrategy: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    return rectIntersection(args);
  }, []);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const data = await getPipelineBoardData({
        search: search.trim() || undefined,
        tagId: selectedTagId !== 'all' ? selectedTagId : undefined,
        agentId: selectedAgentId !== 'all' ? selectedAgentId : undefined,
      });

      setPipelineData(data.pipeline);
      setStages(data.stages);
      setUnassignedLeads(data.unassignedLeads as PipelineContact[]);
      setTotalLeadsCount(data.totalLeadsCount);
      setAvailableTags(data.availableTags);
      setAvailableAgents(data.availableAgents);
    } catch (err: any) {
      toast.error('Failed to load pipeline data');
      console.error(err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [search, selectedTagId, selectedAgentId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  // Handle Drag & Drop with Optimistic UI Update and Reordering
  const handleDropContact = async (
    contactId: string,
    targetStageId: string,
    sourceStageId?: string,
    targetContactId?: string,
    position?: 'before' | 'after'
  ) => {
    // If dropped on the exact same card in the same stage, do nothing
    if (sourceStageId === targetStageId && contactId === targetContactId) return;

    // Locate moving contact
    let movingContact: PipelineContact | undefined;
    let actualSourceStageId = sourceStageId;

    if (sourceStageId === 'unassigned') {
      movingContact = unassignedLeads.find((c) => c.id === contactId);
    } else if (sourceStageId) {
      const srcStage = stages.find((s) => s.id === sourceStageId);
      movingContact = srcStage?.leads.find((c) => c.id === contactId);
    }

    // Fallback: search across all stages and unassigned leads
    if (!movingContact) {
      const unassignedFound = unassignedLeads.find((c) => c.id === contactId);
      if (unassignedFound) {
        movingContact = unassignedFound;
        actualSourceStageId = 'unassigned';
      } else {
        for (const s of stages) {
          const found = s.leads.find((c) => c.id === contactId);
          if (found) {
            movingContact = found;
            actualSourceStageId = s.id;
            break;
          }
        }
      }
    }

    if (!movingContact) return;

    // Target Stage
    const targetStage = stages.find((s) => s.id === targetStageId);

    // Save previous state for rollback on failure
    const prevStages = [...stages];
    const prevUnassigned = [...unassignedLeads];

    // Optimistic Update
    setStages((currentStages) => {
      // 1. Remove contact from source stage
      const updatedStages = currentStages.map((s) => {
        if (s.id === actualSourceStageId) {
          return { ...s, leads: s.leads.filter((c) => c.id !== contactId) };
        }
        return s;
      });

      // 2. Compute updated tags for the moving contact
      const pipelineTagIds = new Set(
        currentStages.flatMap((s) => (s.tagId ? [s.tagId] : []))
      );
      let updatedTags = (movingContact!.tags || []).filter((t) => !pipelineTagIds.has(t.id));
      if (targetStage?.tag && !updatedTags.some((t) => t.id === targetStage.tag!.id)) {
        updatedTags = [...updatedTags, targetStage.tag];
      }
      const updatedContact: PipelineContact = { ...movingContact!, tags: updatedTags };

      // 3. Add contact to target stage at the right position
      return updatedStages.map((s) => {
        if (s.id === targetStageId) {
          const leadsWithoutMoved = s.leads.filter((c) => c.id !== contactId);
          if (targetContactId) {
            const targetIdx = leadsWithoutMoved.findIndex((c) => c.id === targetContactId);
            if (targetIdx !== -1) {
              const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
              const newLeads = [...leadsWithoutMoved];
              newLeads.splice(insertIdx, 0, updatedContact);
              return { ...s, leads: newLeads };
            }
          }
          // Default: add to top of stage
          return { ...s, leads: [updatedContact, ...leadsWithoutMoved] };
        }
        return s;
      });
    });

    if (actualSourceStageId === 'unassigned') {
      setUnassignedLeads((prev) => prev.filter((c) => c.id !== contactId));
    } else if (targetStageId === 'unassigned') {
      setUnassignedLeads((prev) => {
        const withoutMoved = prev.filter((c) => c.id !== contactId);
        if (targetContactId) {
          const targetIdx = withoutMoved.findIndex((c) => c.id === targetContactId);
          if (targetIdx !== -1) {
            const insertIdx = position === 'before' ? targetIdx : targetIdx + 1;
            const newLeads = [...withoutMoved];
            newLeads.splice(insertIdx, 0, movingContact!);
            return newLeads;
          }
        }
        return [movingContact!, ...withoutMoved];
      });
    }

    const isSameStageMove = actualSourceStageId === targetStageId;
    if (isSameStageMove) {
      return;
    }

    try {
      const res = await moveContactStage(contactId, targetStageId, actualSourceStageId);
      if (res?.error) {
        toast.error(res.error);
        setStages(prevStages);
        setUnassignedLeads(prevUnassigned);
      } else {
        const contactName = movingContact.name || movingContact.whatsappName || `+${movingContact.waId}`;
        toast.success(
          `Moved ${contactName} to "${targetStage ? targetStage.name : 'stage'}"`
        );
      }
    } catch (err) {
      toast.error('Failed to move contact');
      setStages(prevStages);
      setUnassignedLeads(prevUnassigned);
    }
  };

  const resolveDropTarget = (
    overId: string | number,
    overData: Record<string, unknown> | undefined
  ): { targetStageId: string; targetContactId?: string } | null => {
    if (overData?.type === 'column') {
      return { targetStageId: overData.stageId as string };
    }
    if (overData?.type === 'card') {
      return {
        targetStageId: overData.stageId as string,
        targetContactId: overId as string,
      };
    }
    if (typeof overId === 'string' && overId.startsWith('column-')) {
      return { targetStageId: overId.replace('column-', '') };
    }
    return null;
  };

  const getLeadsForStage = (stageId: string): PipelineContact[] => {
    if (stageId === 'unassigned') return unassignedLeads;
    return stages.find((s) => s.id === stageId)?.leads ?? [];
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.type === 'card' && data.contact) {
      setActiveDragContact(data.contact as PipelineContact);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragContact(null);

    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const sourceStageId = active.data.current?.stageId as string | undefined;
    if (!sourceStageId) return;

    const target = resolveDropTarget(over.id, over.data.current as Record<string, unknown> | undefined);
    if (!target) return;

    const { targetStageId, targetContactId } = target;

    if (sourceStageId === targetStageId && activeId === targetContactId) return;

    let position: 'before' | 'after' | undefined;
    if (targetContactId) {
      const leads = getLeadsForStage(targetStageId);
      const activeIndex = leads.findIndex((l) => l.id === activeId);
      const overIndex = leads.findIndex((l) => l.id === targetContactId);
      if (activeIndex !== -1 && overIndex !== -1) {
        position = overIndex > activeIndex ? 'after' : 'before';
      } else {
        position = 'before';
      }
    }

    handleDropContact(activeId, targetStageId, sourceStageId, targetContactId, position);
  };

  const handleDragCancel = () => {
    setActiveDragContact(null);
  };

  // Reorder Stages (Move Left / Right)
  const handleMoveStage = async (stageId: string, direction: 'left' | 'right') => {
    const currentIndex = stages.findIndex((s) => s.id === stageId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= stages.length) return;

    const newStages = [...stages];
    const [movedStage] = newStages.splice(currentIndex, 1);
    newStages.splice(targetIndex, 0, movedStage);

    // Update order numbers
    const updatedStageOrders = newStages.map((s, idx) => ({
      id: s.id,
      order: idx,
    }));

    setStages(newStages.map((s, idx) => ({ ...s, order: idx })));

    try {
      await reorderPipelineStages(updatedStageOrders);
    } catch (err) {
      toast.error('Failed to reorder stages');
      loadData(true);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionStrategy}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
    <div className="flex flex-col h-[calc(100vh-65px)] overflow-hidden bg-slate-50 dark:bg-[#070D1E] text-slate-900 dark:text-slate-100">
      {/* Top Header & Filter Toolbar */}
      <div className="shrink-0 p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-[#0B132B]/80 backdrop-blur-md z-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Title & Stats */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <GitCommitHorizontal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Customer Journey Pipeline
                </h1>
                <Badge
                  variant="outline"
                  className="rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-semibold text-xs border-slate-200 dark:border-slate-700"
                >
                  {totalLeadsCount} Total Leads
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Dynamic tag-driven stages for tracking WhatsApp customer lifecycles.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Unassigned Leads Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsUnassignedOpen(true)}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 gap-1.5 h-9"
            >
              <Users className="w-3.5 h-3.5 text-slate-500" />
              Unassigned Leads
              {unassignedLeads.length > 0 && (
                <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                  {unassignedLeads.length}
                </span>
              )}
            </Button>

            {/* Refresh Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="rounded-xl border-slate-200 dark:border-slate-700 text-xs h-9 px-2.5"
              title="Refresh Pipeline"
            >
              <RefreshCw className={cn('w-3.5 h-3.5 text-slate-500', isRefreshing && 'animate-spin')} />
            </Button>

            {/* Add Stage Button */}
            <Button
              size="sm"
              onClick={() => {
                setEditingStage(null);
                setIsStageModalOpen(true);
              }}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs gap-1.5 h-9"
            >
              <Plus className="w-4 h-4" />
              Add Stage
            </Button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex items-center gap-3 mt-4 flex-wrap">
          {/* Search Box */}
          <div className="relative min-w-[220px] max-w-xs flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads by name, phone..."
              className="pl-8.5 h-8.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 focus-visible:ring-emerald-500"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Tag Filter */}
          <div className="w-[180px]">
            <Select value={selectedTagId} onValueChange={setSelectedTagId}>
              <SelectTrigger className="h-8.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 truncate">
                  <TagIcon className="w-3 h-3 text-slate-400 shrink-0" />
                  <SelectValue placeholder="All Tags" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="all">All Tags</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    <div className="flex items-center gap-1.5">
                      <div
                        style={{ backgroundColor: tag.color || '#10B981' }}
                        className="w-2 h-2 rounded-full shrink-0"
                      />
                      <span>#{tag.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Agent Filter */}
          <div className="w-[180px]">
            <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
              <SelectTrigger className="h-8.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-1.5 truncate">
                  <UserIcon className="w-3 h-3 text-slate-400 shrink-0" />
                  <SelectValue placeholder="All Agents" />
                </div>
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs">
                <SelectItem value="all">All Agents</SelectItem>
                {availableAgents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name || agent.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Clear filters if active */}
          {(search || selectedTagId !== 'all' || selectedAgentId !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedTagId('all');
                setSelectedAgentId('all');
              }}
              className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Kanban Board Container */}
      <div className="flex-1 p-6 overflow-x-auto overflow-y-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-7 h-7 text-emerald-500 animate-spin" />
              <p className="text-xs text-slate-400 font-medium">Loading Pipeline Board...</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-5 h-full pb-4 min-w-max">
            {stages.map((stage, idx) => (
              <PipelineColumn
                key={stage.id}
                stage={stage}
                index={idx}
                totalStages={stages.length}
                onEditStage={(s) => {
                  setEditingStage(s);
                  setIsStageModalOpen(true);
                }}
                onDeleteStage={(s) => setDeletingStage(s)}
                onMoveStage={handleMoveStage}
                onOpenChat={(contact) => setChatContact(contact)}
                onOpenProfile={(contact) => setProfileContact(contact)}
              />
            ))}

            {/* Quick Add Stage Card at end of board */}
            <div
              onClick={() => {
                setEditingStage(null);
                setIsStageModalOpen(true);
              }}
              className="w-[280px] h-36 shrink-0 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 dark:hover:border-emerald-500/50 bg-white/30 dark:bg-slate-900/20 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <span className="font-bold text-xs">Add New Stage</span>
            </div>
          </div>
        )}
      </div>

      {/* Unassigned Leads Slideout Sheet */}
      <Sheet open={isUnassignedOpen} onOpenChange={setIsUnassignedOpen}>
        <SheetContent side="right" className="sm:max-w-md w-full p-6 flex flex-col bg-white dark:bg-[#0B132B] border-l border-slate-200 dark:border-slate-800">
          <SheetHeader className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-500" />
              <SheetTitle className="text-base font-bold text-slate-900 dark:text-white">
                Unassigned Leads
              </SheetTitle>
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold text-xs border-0">
                {unassignedLeads.length}
              </Badge>
            </div>
            <SheetDescription className="text-xs text-slate-500 dark:text-slate-400">
              Leads that currently have no tags matching any pipeline stage. Drag them into any stage column to assign.
            </SheetDescription>
          </SheetHeader>

          <UnassignedLeadsPanel
            leads={unassignedLeads}
            onOpenChat={(c) => {
              setChatContact(c);
              setIsUnassignedOpen(false);
            }}
            onOpenProfile={(c) => {
              setProfileContact(c);
              setIsUnassignedOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>

      {/* Create / Edit Stage Modal */}
      <StageModal
        isOpen={isStageModalOpen}
        onClose={() => setIsStageModalOpen(false)}
        stage={editingStage}
        availableTags={availableTags}
        pipelineId={pipelineData?.id}
        onSuccess={() => loadData(true)}
      />

      {/* Delete Stage Modal */}
      <DeleteStageModal
        isOpen={!!deletingStage}
        onClose={() => setDeletingStage(null)}
        stage={deletingStage}
        onSuccess={() => loadData(true)}
      />

      {/* Live Chat Drawer */}
      <ContactChatDrawer
        isOpen={!!chatContact}
        onClose={() => setChatContact(null)}
        contact={chatContact as any}
      />

      {/* Contact Profile Drawer */}
      <ContactProfileDrawer
        contact={profileContact as any}
        onClose={() => setProfileContact(null)}
      />
    </div>

    <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1)' }}>
      {activeDragContact ? (
        <PipelineCardOverlay
          contact={activeDragContact}
          onOpenChat={() => {}}
          onOpenProfile={() => {}}
        />
      ) : null}
    </DragOverlay>
    </DndContext>
  );
}
