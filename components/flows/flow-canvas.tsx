import { useCallback, useState, useRef, DragEvent, useEffect } from'react';
import ReactFlow, {
 MiniMap,
 Controls,
 Background,
 useNodesState,
 useEdgesState,
 addEdge,
 Connection,
 Edge,
 Node,
 BackgroundVariant,
 NodeTypes,
 NodeChange,
 EdgeChange,
} from'reactflow';
import'reactflow/dist/style.css';
import { TriggerNode } from'./nodes/trigger-node';
import { ConditionNode } from'./nodes/condition-node';
import { MessageNode } from'./nodes/message-node';
import { DelayNode } from'./nodes/delay-node';
import { WaitNode } from'./nodes/wait-node';

const nodeTypes: NodeTypes = {
 trigger: TriggerNode,
 condition: ConditionNode,
 message: MessageNode,
 delay: DelayNode,
 input: WaitNode,
};

interface FlowCanvasProps {
 nodes: Node[];
 edges: Edge[];
 onNodesChange: (changes: NodeChange[]) => void;
 onEdgesChange: (changes: EdgeChange[]) => void;
 onConnect: (connection: Connection) => void;
 onSave?: (nodes: Node[], edges: Edge[]) => void;
 onNodeSelect?: (node: Node | null) => void;
 onNodeUpdate?: (nodeId: string, data: any) => void;
}

const getNodeId = () =>`node_${Math.random().toString(36).substr(2, 9)}`;

export function FlowCanvas({
 nodes,
 edges,
 onNodesChange,
 onEdgesChange,
 onConnect,
 onSave,
 onNodeSelect,
 onNodeUpdate
}: FlowCanvasProps) {
 const reactFlowWrapper = useRef<HTMLDivElement>(null);
 const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

 // onConnect logic is now handled by the parent via handleConnect

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

 const newNode: Node = {
 id: getNodeId(),
 type,
 position,
 data: { label:`${type} node` },
 };

 // For new nodes, we can manually apply the addition
 // or use the standard change pattern.
 onNodesChange([{ type:'add', item: newNode }]);
 },
 [reactFlowInstance, nodes, onNodesChange]
 );

 const onNodeClick = useCallback(
 (_event: any, node: Node) => {
 onNodeSelect?.(node);
 },
 [onNodeSelect]
 );

 const onPaneClick = useCallback(() => {
 onNodeSelect?.(null);
 }, [onNodeSelect]);


 const handleSave = useCallback(() => {
 console.log('FlowCanvas handleSave called with:', { nodesCount: nodes.length, edgesCount: edges.length });
 onSave?.(nodes, edges);
 }, [nodes, edges, onSave]);

 return (
 <div className="w-full h-full" ref={reactFlowWrapper}>
 <ReactFlow
 nodes={nodes}
 edges={edges}
 onNodesChange={onNodesChange}
 onEdgesChange={onEdgesChange}
 onConnect={onConnect}
 onInit={setReactFlowInstance}
 onDrop={onDrop}
 onDragOver={onDragOver}
 onNodeClick={onNodeClick}
 onPaneClick={onPaneClick}
 nodeTypes={nodeTypes}
 fitView
 attributionPosition="bottom-left"
 >
 <Controls />
 <MiniMap />
 <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
 </ReactFlow>
 </div>
 );
}
