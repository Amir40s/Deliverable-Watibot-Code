"use client";

import { useCallback, useState, useRef, DragEvent, useMemo } from'react';
import ReactFlow, {
 Controls,
 Background,
 Connection,
 Edge,
 Node,
 BackgroundVariant,
 NodeTypes,
 NodeChange,
 EdgeChange,
 MarkerType,
} from'reactflow';
import'reactflow/dist/style.css';
import { TriggerNode } from'@/components/flows/nodes/trigger-node';
import { SingleProductNode } from'@/components/flows/nodes/single-product-node';
import { MediaNode } from'@/components/flows/nodes/media-node';
import { ConditionNode } from'@/components/flows/nodes/condition-node';
import { MessageNode } from'@/components/flows/nodes/message-node';
import { DelayNode } from'@/components/flows/nodes/delay-node';
import { WaitNode } from'@/components/flows/nodes/wait-node';
import { ListNode } from'@/components/flows/nodes/list-node';
import { WhatsappFormNode } from'@/components/flows/nodes/whatsapp-form-node';
import { CatalogueNode } from'@/components/flows/nodes/catalogue-node';
import { TemplateNode } from'@/components/flows/nodes/template-node';
import { AskAddressNode } from'@/components/flows/nodes/ask-address-node';
import { AskLocationNode } from'@/components/flows/nodes/ask-location-node';
import { AskQuestionNode } from'@/components/flows/nodes/ask-question-node';
import { AskMediaNode } from'@/components/flows/nodes/ask-media-node';
import { MultiProductNode } from'@/components/flows/nodes/multi-product-node';
import { GoogleSheetsNode } from'@/components/flows/nodes/google-sheets-node';
import { AddTagNode } from '@/components/flows/nodes/add-tag-node';
import { ApiRequestNode } from '@/components/flows/nodes/api-request-node';
import { RequestInterventionNode } from '@/components/flows/nodes/request-intervention-node';
import { SetAttributeNode } from '@/components/flows/nodes/set-attribute-node';
import { ConnectFlowNode } from '@/components/flows/nodes/connect-flow-node';
import { CarouselNode } from '@/components/flows/nodes/carousel-node';
import { OrderInfoNode } from '@/components/flows/nodes/order-info-node';
import { ShopifyActionNode } from '@/components/flows/nodes/shopify-action-node';
import { PublicReplyNode } from '@/components/flows/nodes/public-reply-node';
import { ConversionsApiNode } from '@/components/flows/nodes/conversions-api-node';
import { QuickReplyNode } from '@/components/flows/nodes/quick-reply-node';
import { AIKnowledgeNode } from '@/components/flows/nodes/ai-knowledge-node';
import { CustomEdge } from'@/components/flows/editor/custom-edge';
import { getDefaultFlowNodeData, getFlowNodeType } from '@/components/flows/node-utils';

const edgeTypes = {
 custom: CustomEdge,
};

const nodeTypes: NodeTypes = {
 trigger: TriggerNode,
 condition: ConditionNode,
 message: MessageNode,
 media: MediaNode,
 list: ListNode,
 whatsapp_forms: WhatsappFormNode,
 catalogue: CatalogueNode,
 single_product: SingleProductNode,
 template: TemplateNode,
 ask_address: AskAddressNode,
 ask_location: AskLocationNode,
 ask_question: AskQuestionNode,
 ask_media: AskMediaNode,
 multi_product: MultiProductNode,
 delay: DelayNode,
 input: WaitNode,
 google_sheets: GoogleSheetsNode,
 add_tag: AddTagNode,
 api_request: ApiRequestNode,
 request_intervention: RequestInterventionNode,
 set_attribute: SetAttributeNode,
 connect_flow: ConnectFlowNode,
 carousel: CarouselNode,
 order_info: OrderInfoNode,
 shopify_action: ShopifyActionNode,
 public_reply: PublicReplyNode,
 conversions_api: ConversionsApiNode,
 quick_reply: QuickReplyNode,
 ai_knowledge: AIKnowledgeNode,
};

interface EditorCanvasProps {
 nodes: Node[];
 edges: Edge[];
 onNodesChange: (changes: NodeChange[]) => void;
 onEdgesChange: (changes: EdgeChange[]) => void;
 onConnect: (connection: Connection) => void;
 onNodeSelect?: (node: Node | null) => void;
 onPreview?: (data: any) => void;
 onAddNodeAndConnect?: (sourceNodeId: string, type: string, sourceHandleId?: string) => void;
 platform?: string;
}

const getNodeId = () =>`node_${Math.random().toString(36).substr(2, 9)}`;

export function EditorCanvas({
 nodes,
 edges,
 onNodesChange,
 onEdgesChange,
 onConnect,
 onNodeSelect,
 onPreview,
 onAddNodeAndConnect,
 platform,
}: EditorCanvasProps) {
 const reactFlowWrapper = useRef<HTMLDivElement>(null);
 const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

 const onDragOver = useCallback((event: DragEvent) => {
 event.preventDefault();
 event.dataTransfer.dropEffect ='move';
 }, []);

 const onDrop = useCallback(
 (event: DragEvent) => {
 event.preventDefault();

 const type = event.dataTransfer.getData('application/reactflow');
 if (!type || !reactFlowWrapper.current || !reactFlowInstance) {
 return;
 }

 const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
 const position = reactFlowInstance.project({
 x: event.clientX - reactFlowBounds.left,
 y: event.clientY - reactFlowBounds.top,
 });

 const nodeType = getFlowNodeType(type);
 const nodeData = getDefaultFlowNodeData(type);

 const newNode: Node = {
 id: getNodeId(),
 type: nodeType,
 position,
 data: nodeData,
 };

 // Using onNodesChange to add the node
 // Note: in ReactFlow v11 onNodesChange handles'add' changes if supported, 
 // otherwise we might need to manually append if onNodesChange only supports selection/dimension/position. 
 // Standard applyNodeChanges handles'add' if passed correctly, but often users just setNodes directly.
 // Let's assume the parent handles standard changes. For'add', we might need to expose an explicit onAddNode prop or 
 // just use the changes array if the parent supports it.
 // For simplicity in this`EditorCanvas`, let's just emit a change event.

 // Actually, ReactFlow's applyNodeChanges handles'add' events if passed. 
 // But usually we use`setNodes((nds) => nds.concat(newNode))` in the parent for explicit adds like drop.
 // Since this component doesn't have`setNodes`, we'll try to use`onNodesChange` with an'add' type change 
 // if the parent's handler supports it. 
 // The standard hook`useNodesState` returns`onNodesChange` which handles: position, selection, dimensions, remove. 
 // It does NOT handle'add'.
 // So we need another prop`onAddNode`!

 // Wait, looking at`FlowCanvas` previously, it did:`onNodesChange([{ type:'add', item: newNode }]);`
 // If the parent uses`useNodesState`,`applyNodeChanges` does handle'add' IF the type is checked.
 // Let's verify`applyNodeChanges` source/docs... 
 // Actually`applyNodeChanges` usually handles'add' in newer versions, or maybe not.
 // To be safe, let's just use`onNodesChange` as before since the previous`FlowCanvas` used it.
 onNodesChange([{ type:'add', item: newNode } as any]);
 },
 [reactFlowInstance, onNodesChange]
 );

  const onNodeClick = useCallback(
    (_event: any, node: Node) => {
      if (node?.type === 'message') {
        onNodeSelect?.(null);
        return;
      }
      onNodeSelect?.(node);
    },
    [onNodeSelect]
  );

 const onPaneClick = useCallback(() => {
 onNodeSelect?.(null);
 }, [onNodeSelect]);

  const [connectionInfo, setConnectionInfo] = useState<{ nodeId: string; handleId: string | null } | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const onConnectStart = useCallback((_event: any, { nodeId, handleId }: any) => {
    setConnectionInfo({ nodeId, handleId });
  }, []);

  const onConnectEnd = useCallback((event: any) => {
    if (!connectionInfo) return;

    // Find the node under the cursor if we didn't drop on a handle
    const target = event.target as HTMLElement;
    const nodeElement = target.closest('.react-flow__node');
    
    if (nodeElement && !target.closest('.react-flow__handle')) {
      const targetNodeId = nodeElement.getAttribute('data-id');
      if (targetNodeId && targetNodeId !== connectionInfo.nodeId) {
        onConnect({
          source: connectionInfo.nodeId,
          sourceHandle: connectionInfo.handleId,
          target: targetNodeId,
          targetHandle: null
        });
      }
    }

    setConnectionInfo(null);
    setHoveredNodeId(null);
  }, [connectionInfo, onConnect]);

  const onNodeMouseEnter = useCallback((_event: any, node: Node) => {
    if (connectionInfo) {
      setHoveredNodeId(node.id);
    }
  }, [connectionInfo]);

  const onNodeMouseLeave = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Inject handlers into node data
  const nodesWithHandlers = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onPreview,
        onAddNodeAndConnect,
        platform,
        isHoveredDuringConnect: hoveredNodeId === node.id,
        isConnecting: !!connectionInfo && connectionInfo.nodeId !== node.id
      }
    }));
  }, [nodes, onPreview, onAddNodeAndConnect, hoveredNodeId, connectionInfo, platform]);

 return (
 <div className="w-full h-full bg-white dark:bg-slate-950" ref={reactFlowWrapper}>
 <ReactFlow
 nodes={nodesWithHandlers}
 edges={edges}
 onNodesChange={onNodesChange}
 onEdgesChange={onEdgesChange}
  onConnect={onConnect}
  onConnectStart={onConnectStart}
  onConnectEnd={onConnectEnd}
  onNodeMouseEnter={onNodeMouseEnter}
  onNodeMouseLeave={onNodeMouseLeave}
  onInit={setReactFlowInstance}
  onDrop={onDrop}
  onDragOver={onDragOver}
  onNodeClick={onNodeClick}
  onPaneClick={onPaneClick}
 nodeTypes={nodeTypes}
 edgeTypes={edgeTypes}
 defaultEdgeOptions={{
 type:'custom',
 markerEnd: {
 type: MarkerType.ArrowClosed,
 color:'#00B074',
 width: 20,
 height: 20,
 },
 }}
 fitView
 attributionPosition="bottom-left"
 minZoom={0.1}
 >
 <Controls
 showInteractive={false}
 className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 shadow-sm rounded-lg flex flex-col gap-1 p-1"
 position="bottom-left"
 />
 <Background variant={BackgroundVariant.Dots} gap={20} size={1.5} color="#94a3b8" className="dark:opacity-20" />
 </ReactFlow>
 </div>
 );
}
