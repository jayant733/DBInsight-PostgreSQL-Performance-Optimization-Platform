"use client";

import { useMemo } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Edge,
  Node,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { PlanNode as PlanNodeComponent } from './PlanNode';
import { PlanNode as PlanNodeType } from '@/data/executionPlans';

interface PlanGraphProps {
  plan: PlanNodeType;
}

const nodeTypes = {
  custom: PlanNodeComponent,
};

// Extremely simple layout algorithm for execution plans (which are trees)
function generateLayout(root: PlanNodeType, x = 0, y = 0): { nodes: Node[], edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  
  const nodeWidth = 250;
  const nodeHeight = 150;
  
  // Calculate subtree width to center parents over children
  function calculateWidth(node: PlanNodeType): number {
    if (!node.children || node.children.length === 0) return nodeWidth;
    return node.children.reduce((acc, child) => acc + calculateWidth(child), 0) + (node.children.length - 1) * 50;
  }
  
  function traverse(node: PlanNodeType, currentX: number, currentY: number): string {
    const nodeId = node.id;
    
    nodes.push({
      id: nodeId,
      type: 'custom',
      position: { x: currentX, y: currentY },
      data: node as unknown as Record<string, unknown>,
    });
    
    if (node.children && node.children.length > 0) {
      const totalWidth = calculateWidth(node);
      let childX = currentX - totalWidth / 2;
      
      node.children.forEach((child) => {
        const childWidth = calculateWidth(child);
        const centerChildX = childX + childWidth / 2;
        
        const childId = traverse(child, centerChildX, currentY + nodeHeight + 50);
        
        edges.push({
          id: `e-${nodeId}-${childId}`,
          source: nodeId,
          target: childId,
          animated: true,
          style: { stroke: '#888888', strokeWidth: 2 },
        });
        
        childX += childWidth + 50;
      });
    }
    
    return nodeId;
  }
  
  traverse(root, x, y);
  
  return { nodes, edges };
}

export function PlanGraph({ plan }: PlanGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => generateLayout(plan, 400, 50), [plan]);
  
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-full h-[600px] border border-border rounded-lg bg-surface-0 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="dark-theme-flow"
      >
        <Controls className="bg-surface-1 border-border fill-foreground" />
        <MiniMap 
          nodeColor={(n) => {
            const type = String(n.data.type ?? "");
            if (type.includes('Scan')) return '#3b82f6';
            if (type.includes('Join')) return '#a855f7';
            if (type.includes('Agg')) return '#f59e0b';
            if (type.includes('Sort')) return '#00ff88';
            return '#888888';
          }}
          maskColor="rgba(8, 9, 10, 0.7)"
          className="bg-surface-1 border-border"
        />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} color="#1E2028" />
      </ReactFlow>
    </div>
  );
}
