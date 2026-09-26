import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import {
  FileText,
  Sparkles,
  UserCheck,
  GitBranch,
  PhoneCall,
  Clock,
  Calendar,
  ClipboardList,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { WorkflowNodeType } from '../../../types/workflow';

interface CustomNodeData {
  id: string;
  type: WorkflowNodeType;
  title: string;
  description?: string;
  config?: Record<string, any>;
  isStart?: boolean;
  isEnd?: boolean;
}

const getNodeTheme = (type: WorkflowNodeType) => {
  switch (type) {
    case 'APPLICATION_RECEIVED':
      return {
        icon: FileText,
        bg: 'bg-emerald-50',
        border: 'border-emerald-200',
        text: 'text-emerald-800',
        badge: 'bg-emerald-100 text-emerald-700',
        ring: 'ring-emerald-400',
      };
    case 'AI_RESUME_SCREENING':
      return {
        icon: Sparkles,
        bg: 'bg-purple-50',
        border: 'border-purple-200',
        text: 'text-purple-800',
        badge: 'bg-purple-100 text-purple-700',
        ring: 'ring-purple-400',
      };
    case 'HR_REVIEW':
      return {
        icon: UserCheck,
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        text: 'text-amber-800',
        badge: 'bg-amber-100 text-amber-700',
        ring: 'ring-amber-400',
      };
    case 'CONDITION':
      return {
        icon: GitBranch,
        bg: 'bg-sky-50',
        border: 'border-sky-200',
        text: 'text-sky-800',
        badge: 'bg-sky-100 text-sky-700',
        ring: 'ring-sky-400',
      };
    case 'AI_CALLING':
      return {
        icon: PhoneCall,
        bg: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800',
        badge: 'bg-blue-100 text-blue-700',
        ring: 'ring-blue-400',
      };
    case 'WAIT_DELAY':
      return {
        icon: Clock,
        bg: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800',
        badge: 'bg-orange-100 text-orange-700',
        ring: 'ring-orange-400',
      };
    case 'CANDIDATE_AVAILABILITY':
      return {
        icon: Calendar,
        bg: 'bg-teal-50',
        border: 'border-teal-200',
        text: 'text-teal-800',
        badge: 'bg-teal-100 text-teal-700',
        ring: 'ring-teal-400',
      };
    case 'MANUAL_TASK':
      return {
        icon: ClipboardList,
        bg: 'bg-slate-50',
        border: 'border-slate-200',
        text: 'text-slate-800',
        badge: 'bg-slate-100 text-slate-700',
        ring: 'ring-slate-400',
      };
    case 'HR_FINAL_DECISION':
      return {
        icon: ShieldCheck,
        bg: 'bg-rose-50',
        border: 'border-rose-200',
        text: 'text-rose-800',
        badge: 'bg-rose-100 text-rose-700',
        ring: 'ring-rose-400',
      };
    case 'END':
      return {
        icon: CheckCircle2,
        bg: 'bg-zinc-100',
        border: 'border-zinc-300',
        text: 'text-zinc-800',
        badge: 'bg-zinc-200 text-zinc-700',
        ring: 'ring-zinc-400',
      };
    default:
      return {
        icon: GitBranch,
        bg: 'bg-white',
        border: 'border-gray-200',
        text: 'text-gray-800',
        badge: 'bg-gray-100 text-gray-700',
        ring: 'ring-blue-400',
      };
  }
};

const CustomWorkflowNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as unknown as CustomNodeData;
  const type = nodeData?.type || 'APPLICATION_RECEIVED';
  const theme = getNodeTheme(type);
  const Icon = theme.icon;

  const isStart = type === 'APPLICATION_RECEIVED';
  const isEnd = type === 'END';
  const isCondition = type === 'CONDITION';

  return (
    <div
      className={`min-w-[220px] max-w-[280px] rounded-xl border bg-white shadow-sm transition-all duration-150 ${
        selected ? `ring-2 ${theme.ring} shadow-md` : 'hover:border-gray-400'
      } ${theme.border}`}
    >
      {/* Target handle on top (except start node) */}
      {!isStart && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white transition-all hover:!scale-125"
        />
      )}

      {/* Node Header */}
      <div className={`flex items-center gap-2.5 px-3 py-2.5 border-b rounded-t-xl ${theme.bg} ${theme.border}`}>
        <div className={`p-1.5 rounded-lg bg-white shadow-xs ${theme.text}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold tracking-wide uppercase text-slate-600">
            {type.replace(/_/g, ' ')}
          </div>
          <div className="text-[13px] font-semibold text-slate-900 truncate">
            {nodeData.title || type}
          </div>
        </div>
      </div>

      {/* Node Body Details */}
      <div className="px-3 py-2 text-[12px] text-slate-700">
        {type === 'AI_CALLING' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Provider:</span>
              <span className="font-medium text-slate-800">{nodeData.config?.provider || 'ElevenLabs'}</span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Max Attempts:</span>
              <span className="font-medium text-slate-800">{nodeData.config?.max_attempts || 3}</span>
            </div>
          </div>
        )}

        {type === 'CONDITION' && (
          <div className="text-[11px] text-slate-500">
            {nodeData.config?.rules?.length || 0} evaluation rules configured
          </div>
        )}

        {type === 'WAIT_DELAY' && (
          <div className="text-[11px] text-slate-500">
            Wait for {nodeData.config?.delay_amount || 24} {nodeData.config?.delay_unit || 'hours'}
          </div>
        )}

        {type === 'HR_REVIEW' && (
          <div className="text-[11px] text-slate-500">
            Requires human recruiter assessment
          </div>
        )}

        {type === 'AI_RESUME_SCREENING' && (
          <div className="text-[11px] text-slate-500">
            Match score threshold: {nodeData.config?.passing_threshold || 70}%
          </div>
        )}

        {type === 'HR_FINAL_DECISION' && (
          <div className="text-[11px] text-rose-700 font-medium">
            Offer / Reject human checkpoint
          </div>
        )}

        {type === 'APPLICATION_RECEIVED' && (
          <div className="text-[11px] text-emerald-700">
            Workflow Entrypoint
          </div>
        )}

        {type === 'END' && (
          <div className="text-[11px] text-zinc-500">
            Process completed
          </div>
        )}
      </div>

      {/* Handles on bottom */}
      {!isEnd && !isCondition && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-slate-500 !border-2 !border-white transition-all hover:!scale-125"
        />
      )}

      {/* Condition handles */}
      {isCondition && (
        <div className="flex justify-between px-4 pb-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
          <div className="relative">
            <span>Pass</span>
            <Handle
              id="pass"
              type="source"
              position={Position.Bottom}
              className="!w-2.5 !h-2.5 !bg-emerald-500 !border-2 !border-white"
            />
          </div>
          <div className="relative">
            <span>Fail</span>
            <Handle
              id="fail"
              type="source"
              position={Position.Bottom}
              className="!w-2.5 !h-2.5 !bg-rose-500 !border-2 !border-white"
            />
          </div>
          <div className="relative">
            <span>Default</span>
            <Handle
              id="default"
              type="source"
              position={Position.Bottom}
              className="!w-2.5 !h-2.5 !bg-slate-400 !border-2 !border-white"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export const CustomWorkflowNode = memo(CustomWorkflowNodeComponent);

export const nodeTypes = {
  customNode: CustomWorkflowNode,
  APPLICATION_RECEIVED: CustomWorkflowNode,
  AI_RESUME_SCREENING: CustomWorkflowNode,
  HR_REVIEW: CustomWorkflowNode,
  CONDITION: CustomWorkflowNode,
  AI_CALLING: CustomWorkflowNode,
  WAIT_DELAY: CustomWorkflowNode,
  CANDIDATE_AVAILABILITY: CustomWorkflowNode,
  MANUAL_TASK: CustomWorkflowNode,
  HR_FINAL_DECISION: CustomWorkflowNode,
  END: CustomWorkflowNode,
};
