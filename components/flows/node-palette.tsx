'use client';

import { DragEvent } from'react';
import { Play, GitBranch, MessageSquare, Clock, Keyboard, Zap, Bot } from'lucide-react';

const nodeTypes = [
 {
 type:'trigger',
 label:'Trigger',
 description:'Start the flow',
 icon: Play,
 color:'emerald',
 },
 {
 type:'condition',
 label:'Condition',
 description:'If-else logic',
 icon: GitBranch,
 color:'blue',
 },
 {
 type:'message',
 label:'Send Message',
 description:'WhatsApp message',
 icon: MessageSquare,
 color:'purple',
 },
 {
 type:'delay',
 label:'Delay',
 description:'Wait for duration',
 icon: Clock,
 color:'orange',
 },
 {
 type:'input',
 label:'Wait for Input',
 description:'User response',
 icon: Keyboard,
 color:'cyan',
 },
 {
 type:'api',
 label:'API Call',
 description:'External request',
 icon: Zap,
 color:'yellow',
 },
  {
    type: 'set_attribute',
    label: 'Set Attribute',
    description: 'Save value to variable',
    icon: Zap,
    color: 'emerald',
  },
  {
    type: 'add-tag',
    label: 'Add Tag',
    description: 'Assign tag to contact',
    icon: Zap,
    color: 'blue',
  },
  {
    type: 'request_intervention',
    label: 'Assign Agent',
    description: 'Handover to human agent',
    icon: Bot,
    color: 'rose',
  },
  {
    type: 'public_reply',
    label: 'Public Reply',
    description: 'Reply to FB/IG comment',
    icon: MessageSquare,
    color: 'blue',
  },
];

const colorClasses = {
 emerald:'bg-emerald-500/10 text-emerald-600 border-emerald-200 hover:bg-emerald-500/20',
 blue:'bg-blue-500/10 text-blue-600 border-blue-200 hover:bg-blue-500/20',
 purple:'bg-purple-500/10 text-purple-600 border-purple-200 hover:bg-purple-500/20',
 orange:'bg-orange-500/10 text-orange-600 border-orange-200 hover:bg-orange-500/20',
 cyan:'bg-cyan-500/10 text-cyan-600 border-cyan-200 hover:bg-cyan-500/20',
 yellow:'bg-yellow-500/10 text-yellow-600 border-yellow-200 hover:bg-yellow-500/20',
 rose:'bg-rose-500/10 text-rose-600 border-rose-200 hover:bg-rose-500/20',
};

interface NodePaletteProps {
 hasTrigger: boolean;
}

export function NodePalette({ hasTrigger }: NodePaletteProps) {
 const onDragStart = (event: DragEvent, nodeType: string) => {
 if (!hasTrigger && nodeType !=='trigger') {
 event.preventDefault();
 return;
 }
 event.dataTransfer.setData('application/reactflow', nodeType);
 event.dataTransfer.effectAllowed ='move';
 };

 return (
 <div className="w-64 border-r border-border bg-background p-4 overflow-y-auto">
 <div className="mb-4">
 <h3 className="text-sm font-semibold mb-1">Node Palette</h3>
 <p className="text-xs text-muted-foreground">
 {!hasTrigger ?'Add a Trigger node first' :'Drag nodes to canvas'}
 </p>
 </div>
 <div className="space-y-2">
 {nodeTypes.map((node) => {
 const Icon = node.icon;
 const isDisabled = !hasTrigger && node.type !=='trigger';

 return (
 <div
 key={node.type}
 draggable={!isDisabled}
 onDragStart={(e) => onDragStart(e, node.type)}
 className={`p-3 rounded-lg border transition-all ${isDisabled
 ?'opacity-40 grayscale cursor-not-allowed border-dashed bg-muted'
 :`cursor-move ${colorClasses[node.color as keyof typeof colorClasses]}`
 }`}
 title={isDisabled ? "Add a starting Trigger first" : node.description}
 >
 <div className="flex items-center gap-2 mb-1">
 <Icon className="w-4 h-4" />
 <span className="text-xs font-semibold">{node.label}</span>
 </div>
 <p className="text-[10px] opacity-75">{node.description}</p>
 </div>
 );
 })}
 </div>
 </div>
 );
}
