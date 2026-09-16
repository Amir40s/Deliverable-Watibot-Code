import { BaseEdge, EdgeProps, getSmoothStepPath, useReactFlow } from'reactflow';
import { X } from'lucide-react';

export function CustomEdge({
 id,
 sourceX,
 sourceY,
 targetX,
 targetY,
 sourcePosition,
 targetPosition,
 style = {},
 markerEnd,
}: EdgeProps) {
 const { setEdges } = useReactFlow();

 const [edgePath, labelX, labelY] = getSmoothStepPath({
 sourceX,
 sourceY,
 sourcePosition,
 targetX,
 targetY,
 targetPosition,
 });

 return (
 <>
 <BaseEdge
 path={edgePath}
 markerEnd={markerEnd}
 style={{
 ...style,
 stroke:'#00B074',
 strokeWidth: 2,
 strokeDasharray:'8,8',
 animation:'flow 30s linear infinite',
 }}
 />
 <style dangerouslySetInnerHTML={{ __html:`
 @keyframes flow {
 from { stroke-dashoffset: 200; }
 to { stroke-dashoffset: 0; }
 }
`}} />
 <foreignObject
 width={20}
 height={20}
 x={labelX - 10}
 y={labelY - 10}
 style={{ overflow:'visible' }}
 requiredExtensions="http://www.w3.org/1999/xhtml"
 >
 <button
 className="w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center text-gray-500 hover:text-red-500 hover:border-red-500 transition-colors shadow-sm"
 onClick={() => {
 setEdges((edges) => edges.filter((e) => e.id !== id));
 }}
 type="button"
 >
 <X className="w-3 h-3" />
 </button>
 </foreignObject>
 </>
 );
}
