"use client";

import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { EditorSidebar } from '@/components/flows/editor/EditorSidebar';
import { EditorHeader } from '@/components/flows/editor/EditorHeader';
import { EditorCanvas } from '@/components/flows/editor/EditorCanvas';
import { WhatsAppPreview } from '@/components/flows/preview/whatsapp-preview';
import { NodeConfigPanel } from '@/components/flows/node-config-panel'; // Keeping this for now or redesign later
import { updateFlow } from '@/app/actions/flows';
import { Node, Edge, NodeChange, EdgeChange, applyNodeChanges, applyEdgeChanges, addEdge, Connection } from 'reactflow';
import { getDefaultFlowNodeData, getFlowNodeType } from '@/components/flows/node-utils';

interface FlowEditorProps {
    flow: {
        id: string;
        name: string;
        description: string | null;
        nodes: any;
        edges: any;
        isActive: boolean;
        platform?: string | null;
        organizationId?: string;
    };
}

export function FlowEditor({ flow }: FlowEditorProps) {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [isActive, setIsActive] = useState(flow.isActive);
    const [selectedNode, setSelectedNode] = useState<Node | null>(null);

    const handleNodeSelect = useCallback((node: Node | null) => {
        if (!node || node.type === 'message') {
            setSelectedNode(null);
            return;
        }
        setSelectedNode(node);
    }, []);
    const [previewData, setPreviewData] = useState<any>(null);
    const [flowName, setFlowName] = useState(flow.name);

    const handlePreview = useCallback((data: any) => {
        setPreviewData(data);
    }, []);

    // Initialize nodes and edges from flow data
    useEffect(() => {
        if (flow.nodes && Array.isArray(flow.nodes) && flow.nodes.length > 0) {
            setNodes(flow.nodes as Node[]);
        } else {
            // Automatically provide a default trigger node for new flows
            const defaultTriggerNode: Node = {
                id: `trigger_${Math.random().toString(36).substr(2, 9)}`,
                type: 'trigger',
                position: { x: 250, y: 50 },
                data: { 
                    label: 'Flow Start',
                    triggerType: flow.platform === 'INSTAGRAM_STORY_REPLY' ? 'story_reply' : flow.platform === 'SHOPIFY' ? 'shopify_event' : 'keyword',
                    platform: flow.platform || 'WHATSAPP',
                    shopifyEvent: flow.platform === 'SHOPIFY' ? 'orders/create' : undefined
                },
            };
            setNodes([defaultTriggerNode]);

            // Immediately save it to the DB so it persists
            updateFlow(flow.id, {
                nodes: [defaultTriggerNode],
                edges: Array.isArray(flow.edges) ? flow.edges : [],
                trigger: { type: 'manual', config: {} },
                isActive: flow.isActive
            });
        }
        if (flow.edges && Array.isArray(flow.edges)) {
            setEdges(flow.edges as Edge[]);
        }
    }, [flow.id]);

    const handleRename = async (newName: string) => {
        setFlowName(newName);
        try {
            await updateFlow(flow.id, { name: newName });
            toast.success('Flow renamed successfully');
        } catch (error) {
            console.error('Rename error:', error);
            toast.error('Failed to rename flow');
            setFlowName(flow.name); // Revert on error
        }
    };

    const handleSave = async (updatedNodes?: Node[], updatedEdges?: Edge[], newStatus?: boolean) => {
        // Deeply sanitize nodes and edges to remove any non-serializable properties (functions, symbols, pointers)
        // that React Flow handles might have injected or used internally.
        const nodesToSave = JSON.parse(JSON.stringify(
            (updatedNodes || nodes).map(node => ({
                id: node.id,
                type: node.type,
                position: node.position,
                data: node.data,
            }))
        ));

        const edgesToSave = JSON.parse(JSON.stringify(
            (updatedEdges || edges).map(edge => ({
                id: edge.id,
                source: edge.source,
                target: edge.target,
                sourceHandle: edge.sourceHandle,
                type: edge.type,
            }))
        ));

        const statusToSave = newStatus !== undefined ? newStatus : isActive;

        setIsSaving(true);
        try {
            await updateFlow(flow.id, {
                nodes: nodesToSave,
                edges: edgesToSave,
                isActive: statusToSave,
            });
            toast.success('Flow saved successfully');
        } catch (error) {
            console.error('Save error:', error);
            toast.error('Failed to save flow');
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportJson = () => {
        try {
            const exportData = {
                name: flow.name,
                description: flow.description,
                trigger: (flow as any).trigger || { type: 'manual', config: {} },
                nodes: nodes,
                edges: edges,
                version: '1.0'
            };

            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${flow.name.replace(/\s+/g, '_')}_design.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success('Flow design exported as JSON');
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Failed to export flow design');
        }
    };

    const handleNodeUpdate = (nodeId: string, data: any) => {
        setNodes((prevNodes) => {
            const newNodes = prevNodes.map((node) =>
                node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
            );
            return newNodes;
        });
        if (selectedNode?.id === nodeId) {
            setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...data } } : null);
        }
    };

    const onNodesChange = useCallback((changes: NodeChange[]) => {
        setNodes((nds) => applyNodeChanges(changes, nds));

        // If a node is being removed, check if it was the selected one
        const removedNodeIds = changes
            .filter((c) => c.type === 'remove')
            .map((c: any) => c.id);

        if (selectedNode && removedNodeIds.includes(selectedNode.id)) {
            setSelectedNode(null);
        }
    }, [selectedNode]);

    const onEdgesChange = useCallback((changes: EdgeChange[]) => {
        setEdges((eds) => applyEdgeChanges(changes, eds));
    }, []);

    const onConnect = useCallback((params: Connection) => {
        setEdges((eds) => addEdge(params, eds));
    }, []);

    const onToggleActive = (active: boolean) => {
        setIsActive(active);
        handleSave(undefined, undefined, active);
    }

    const handleAddNode = (type: string) => {
        const id = `node_${Math.random().toString(36).substr(2, 9)}`;
        const nodeData = getDefaultFlowNodeData(type);

        const newNode: Node = {
            id,
            type: getFlowNodeType(type),
            position: { x: 250, y: 5 },
            data: nodeData,
        };
        setNodes((nds) => nds.concat(newNode));
    };

    const getNodeType = (type: string) => {
        return getFlowNodeType(type);
    };

    const handleAddNodeAndConnect = useCallback((sourceNodeId: string, type: string, sourceHandleId?: string) => {
        const sourceNode = nodes.find(n => n.id === sourceNodeId);
        if (!sourceNode) return;

        const newNodeId = `node_${Math.random().toString(36).substr(2, 9)}`;
        const newNode: Node = {
            id: newNodeId,
            type: getNodeType(type),
            position: {
                x: sourceNode.position.x + 400,
                y: sourceNode.position.y
            },
            data: getDefaultFlowNodeData(type),
        };

        const newEdge: Edge = {
            id: `edge_${sourceNodeId}_${newNodeId}`,
            source: sourceNodeId,
            target: newNodeId,
            sourceHandle: sourceHandleId || 'right',
            type: 'custom',
        };

        setNodes((nds) => nds.concat(newNode));
        setEdges((eds) => eds.concat(newEdge));
    }, [nodes]);

    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <EditorHeader
                flowName={flowName}
                onSave={() => handleSave()}
                isSaving={isSaving}
                isActive={isActive}
                onToggleActive={onToggleActive}
                onExport={handleExportJson}
                onRename={handleRename}
            />

            <div className="flex flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <EditorSidebar
                    onNodeAdd={handleAddNode}
                    platform={flow.platform || "WHATSAPP"}
                />

                {/* Main Canvas Area */}
                <div className="flex-1 relative border-l border-gray-100 dark:border-slate-800">
                    <EditorCanvas
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeSelect={handleNodeSelect}
                        onPreview={handlePreview}
                        onAddNodeAndConnect={handleAddNodeAndConnect}
                        platform={flow.platform || 'WHATSAPP'}
                    />


                    <WhatsAppPreview
                        isOpen={!!previewData}
                        onClose={() => setPreviewData(null)}
                        data={previewData}
                    />
                </div>

                {/* Right Config Panel */}
                {selectedNode && selectedNode.type !== 'message' && (
                    <div className="w-[350px] border-l border-gray-105 dark:border-slate-800 z-10 shrink-0">
                        <NodeConfigPanel
                            selectedNode={selectedNode}
                            onClose={() => setSelectedNode(null)}
                            onUpdate={handleNodeUpdate}
                            organizationId={flow.organizationId}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
