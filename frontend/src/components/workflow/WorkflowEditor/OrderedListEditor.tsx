import React from 'react';
import {
  ArrowDown,
  ChevronUp,
  ChevronDown,
  Trash2,
  Settings,
  Plus,
  GitBranch,
  PhoneCall,
  Sparkles,
  UserCheck,
  ShieldCheck,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { WorkflowNodeData, WorkflowEdgeData, WorkflowNodeType } from '../../../types/workflow';

interface OrderedListEditorProps {
  nodes: WorkflowNodeData[];
  edges?: WorkflowEdgeData[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
  onMoveNode: (fromIndex: number, toIndex: number) => void;
  onDeleteNode: (nodeId: string) => void;
  onAddStepClick: () => void;
}

const getNodeIcon = (type: WorkflowNodeType) => {
  switch (type) {
    case 'APPLICATION_RECEIVED':
      return <FileText className="w-4 h-4 text-emerald-600" />;
    case 'AI_RESUME_SCREENING':
      return <Sparkles className="w-4 h-4 text-purple-600" />;
    case 'HR_REVIEW':
      return <UserCheck className="w-4 h-4 text-amber-600" />;
    case 'CONDITION':
      return <GitBranch className="w-4 h-4 text-sky-600" />;
    case 'AI_CALLING':
      return <PhoneCall className="w-4 h-4 text-blue-600" />;
    case 'HR_FINAL_DECISION':
      return <ShieldCheck className="w-4 h-4 text-rose-600" />;
    case 'END':
      return <CheckCircle2 className="w-4 h-4 text-zinc-600" />;
    default:
      return <GitBranch className="w-4 h-4 text-slate-600" />;
  }
};

export const OrderedListEditor: React.FC<OrderedListEditorProps> = ({
  nodes,
  selectedNodeId,
  onSelectNode,
  onMoveNode,
  onDeleteNode,
  onAddStepClick
}) => {
  return (
    <div className="flex-1 bg-slate-50 overflow-y-auto p-6 flex flex-col items-center">
      <div className="w-full max-w-2xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-800">Sequential Step Flow</h2>
            <p className="text-xs text-slate-500">Accessible step sequence with keyboard navigation and step reordering</p>
          </div>
          <button
            type="button"
            onClick={onAddStepClick}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Step</span>
          </button>
        </div>

        <div className="space-y-3">
          {nodes.map((node, index) => {
            const isSelected = selectedNodeId === node.id;
            const isStart = node.type === 'APPLICATION_RECEIVED';
            const isEnd = node.type === 'END';

            return (
              <React.Fragment key={node.id}>
                {/* Step Card */}
                <div
                  className={`p-4 rounded-xl border bg-white shadow-xs transition-all ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-100 shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 font-mono text-xs flex items-center justify-center font-bold">
                        {index + 1}
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 border border-slate-100">
                        {getNodeIcon(node.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {node.title || node.type}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 uppercase">
                            {node.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {node.description && (
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            {node.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={index === 0 || isStart}
                        onClick={() => onMoveNode(index, index - 1)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Move Up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        disabled={index === nodes.length - 1 || isEnd}
                        onClick={() => onMoveNode(index, index + 1)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Move Down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectNode(node.id)}
                        className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        title="Configure Step"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {!isStart && !isEnd && (
                        <button
                          type="button"
                          onClick={() => onDeleteNode(node.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove Step"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Connector arrow between steps */}
                {index < nodes.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="w-4 h-4 text-slate-300" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};
