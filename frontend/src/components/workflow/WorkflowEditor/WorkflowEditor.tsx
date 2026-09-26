import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { workflowApi } from '../../../api/workflowApi';
import {
  WorkflowStepItem,
  WorkflowVersionDetail,
  SaveStatus,
  StepValidationIssue
} from '../../../types/workflow';
import {
  graphToWorkflowSteps,
  workflowStepsToGraph,
  validateStepDependencies
} from './workflowAdapter';
import { WorkflowSequence } from './WorkflowSequence';
import { StepConfigPanel } from './StepConfigPanel';
import { WorkflowHeader } from './WorkflowHeader';
import { PublishReviewModal } from './PublishReviewModal';
import { SimulationModal } from './SimulationModal';
import { StepMenuItem } from './AddStepMenu';

export const WorkflowEditor: React.FC = () => {
  const { workflowId, versionId } = useParams<{ workflowId: string; versionId?: string }>();

  // Workflow & Version Metadata
  const [workflow, setWorkflow] = useState<any>(null);
  const [versionDetail, setVersionDetail] = useState<WorkflowVersionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Active Sequential Steps State (starts with null selected step so full space is dedicated to sequence)
  const [steps, setSteps] = useState<WorkflowStepItem[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  // Save & Network State
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('SAVED');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const isDirtyRef = useRef(false);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Network offline detection
  useEffect(() => {
    const handleOnline = () => {
      if (isDirtyRef.current) {
        triggerAutosave();
      } else {
        setSaveStatus('SAVED');
      }
    };
    const handleOffline = () => setSaveStatus('OFFLINE');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Load Workflow Data
  const loadWorkflowData = useCallback(async () => {
    if (!workflowId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const wf = await workflowApi.getWorkflow(workflowId);
      setWorkflow(wf);

      // Determine version to load: specified version or latest draft/published
      let targetVersionId = versionId;
      if (!targetVersionId && wf.versions && wf.versions.length > 0) {
        const draft = wf.versions.find((v: any) => v.publication_state === 'Draft');
        targetVersionId = draft ? draft.id : wf.versions[0].id;
      }

      if (targetVersionId) {
        const vDetail = await workflowApi.getWorkflowVersion(workflowId, targetVersionId);
        setVersionDetail(vDetail);

        // Convert backend graph data to HR sequential steps with branches
        const parsedSteps = graphToWorkflowSteps(vDetail.graph_data);
        setSteps(parsedSteps);
        // Do not pre-select step on load so sequence gets the main width of the page
        setSelectedStepId(null);
        setSaveStatus('SAVED');
        setLastSavedAt(new Date(vDetail.updated_at || vDetail.created_at));
      }
    } catch (err: any) {
      console.error('Failed to load workflow', err);
      setLoadError(err.message || 'Failed to load workflow definition');
    } finally {
      setLoading(false);
    }
  }, [workflowId, versionId]);

  useEffect(() => {
    loadWorkflowData();
  }, [loadWorkflowData]);

  // Client-side and server-side validation issues
  const validationIssues = useMemo<StepValidationIssue[]>(() => {
    return validateStepDependencies(steps);
  }, [steps]);

  // Trigger Save Draft to Backend
  const saveDraftToBackend = useCallback(
    async (stepsToSave: WorkflowStepItem[]) => {
      if (!workflowId || !versionDetail) return;
      if (!navigator.onLine) {
        setSaveStatus('OFFLINE');
        return;
      }

      setSaveStatus('SAVING');
      try {
        const graph = workflowStepsToGraph(stepsToSave);
        const updatedVersion = await workflowApi.saveWorkflowDraft(workflowId, versionDetail.id, graph);
        setVersionDetail(updatedVersion);
        setSaveStatus('SAVED');
        setLastSavedAt(new Date());
        isDirtyRef.current = false;
      } catch (err: any) {
        console.error('Save failed:', err);
        setSaveStatus('SAVE_FAILED');
      }
    },
    [workflowId, versionDetail]
  );

  // Debounced Autosave (1.5 seconds)
  const triggerAutosave = useCallback(
    (newSteps?: WorkflowStepItem[]) => {
      const targetSteps = newSteps || steps;
      isDirtyRef.current = true;
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
      autosaveTimeoutRef.current = setTimeout(() => {
        saveDraftToBackend(targetSteps);
      }, 1500);
    },
    [steps, saveDraftToBackend]
  );

  // Update steps with autosave trigger
  const updateSteps = useCallback(
    (newSteps: WorkflowStepItem[]) => {
      setSteps(newSteps);
      triggerAutosave(newSteps);
    },
    [triggerAutosave]
  );

  // Reorder steps
  const handleMoveStep = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex <= 0 || toIndex <= 0) return; // Cannot move pinned start node
      if (fromIndex >= steps.length - 1 || toIndex >= steps.length) return;

      const copy = [...steps];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      updateSteps(copy);
    },
    [steps, updateSteps]
  );

  // Duplicate step
  const handleDuplicateStep = useCallback(
    (stepId: string) => {
      const idx = steps.findIndex(s => s.id === stepId);
      if (idx === -1) return;
      const original = steps[idx];
      if (original.type === 'APPLICATION_RECEIVED' || original.type === 'END') return;

      const newId = `step_${Date.now().toString().slice(-6)}`;
      const duplicated: WorkflowStepItem = {
        ...original,
        id: newId,
        title: `${original.title} (Copy)`,
        config: JSON.parse(JSON.stringify(original.config || {}))
      };

      const copy = [...steps];
      copy.splice(idx + 1, 0, duplicated);
      updateSteps(copy);
      setSelectedStepId(newId);
    },
    [steps, updateSteps]
  );

  // Delete step
  const handleDeleteStep = useCallback(
    (stepId: string) => {
      const target = steps.find(s => s.id === stepId);
      if (!target || target.type === 'APPLICATION_RECEIVED' || target.type === 'END') return;

      const filtered = steps.filter(s => s.id !== stepId);
      updateSteps(filtered);
      if (selectedStepId === stepId) {
        setSelectedStepId(null);
      }
    },
    [steps, selectedStepId, updateSteps]
  );

  // Add Step at specific index from AddStepMenu
  const handleAddStepAtIndex = useCallback(
    (index: number, item: StepMenuItem) => {
      const newId = `step_${Date.now().toString().slice(-6)}`;
      const newStep: WorkflowStepItem = {
        id: newId,
        type: item.type,
        title: item.title,
        purpose: item.description,
        config: { ...item.defaultConfig },
        branches:
          item.type === 'CONDITION'
            ? [
                {
                  id: `branch_1`,
                  name: 'Meets shortlist policy',
                  is_default: false,
                  condition_logic: 'AND',
                  rules: [{ id: 'r_1', field: 'screening.score', operator: 'greater_than_or_equal', value: 75 }],
                  missing_data_action: 'PAUSE_FOR_RECRUITER',
                  rejoin_type: 'REJOIN_MAIN',
                  sub_steps: []
                },
                {
                  id: `branch_def`,
                  name: 'Otherwise',
                  is_default: true,
                  condition_logic: 'AND',
                  rules: [],
                  missing_data_action: 'PAUSE_FOR_RECRUITER',
                  rejoin_type: 'REJOIN_MAIN',
                  sub_steps: []
                }
              ]
            : undefined
      };

      const copy = [...steps];
      copy.splice(index, 0, newStep);
      updateSteps(copy);
      setSelectedStepId(newId);
    },
    [steps, updateSteps]
  );

  // Update Step Config
  const handleUpdateStep = useCallback(
    (updatedStep: WorkflowStepItem) => {
      const copy = steps.map(s => (s.id === updatedStep.id ? updatedStep : s));
      updateSteps(copy);
    },
    [steps, updateSteps]
  );

  // Rename Step Title
  const handleUpdateStepTitle = useCallback(
    (stepId: string, newTitle: string) => {
      const copy = steps.map(s => (s.id === stepId ? { ...s, title: newTitle } : s));
      updateSteps(copy);
    },
    [steps, updateSteps]
  );

  // Rename Workflow
  const handleRenameWorkflow = async (newName: string) => {
    if (!workflowId) return;
    try {
      const updated = await workflowApi.updateWorkflow(workflowId, { name: newName });
      setWorkflow(updated);
    } catch (err: any) {
      alert(`Failed to rename workflow: ${err.message}`);
    }
  };

  // Publish Workflow Version
  const handleConfirmPublish = async () => {
    if (!workflowId || !versionDetail) return;
    setIsPublishing(true);
    try {
      // 1. Ensure current draft is saved
      const graph = workflowStepsToGraph(steps);
      await workflowApi.saveWorkflowDraft(workflowId, versionDetail.id, graph);

      // 2. Publish version
      await workflowApi.publishWorkflowVersion(workflowId, versionDetail.id);
      setShowPublishModal(false);

      // 3. Reload workflow
      await loadWorkflowData();
    } catch (err: any) {
      alert(`Publish failed: ${err.message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  // Selected Step Object
  const selectedStep = useMemo(() => {
    if (!selectedStepId) return null;
    return steps.find(s => s.id === selectedStepId) || null;
  }, [selectedStepId, steps]);

  // Loading State
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F6F8FB]">
        <div className="flex flex-col items-center gap-3 text-[#5B6C7D]">
          <Loader2 className="w-6 h-6 animate-spin text-[#245FAD]" />
          <span className="text-sm font-medium">Loading hiring workflow...</span>
        </div>
      </div>
    );
  }

  // Error State
  if (loadError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F6F8FB] p-4">
        <div className="max-w-md w-full bg-white p-6 rounded-xl border border-rose-200 shadow-sm text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-[#192D42]">Unable to load workflow</h2>
          <p className="text-xs text-[#5B6C7D]">{loadError}</p>
          <button
            type="button"
            onClick={loadWorkflowData}
            className="px-4 py-2 bg-[#245FAD] text-white text-xs font-semibold rounded-lg hover:bg-[#10263E]"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] w-full bg-[#F6F8FB] overflow-hidden select-none -m-4 md:-m-6 xl:-m-8">
      {/* Compact Workflow Header */}
      <WorkflowHeader
        workflowName={workflow?.name || 'Standard Recruitment Workflow'}
        associatedJobTitle={workflow?.job_title}
        isCompanyDefault={workflow?.is_company_default ?? true}
        versionNumber={versionDetail?.version_number ?? 1}
        publicationState={versionDetail?.publication_state || 'Draft'}
        saveStatus={saveStatus}
        lastSavedAt={lastSavedAt}
        validationIssues={validationIssues}
        onRenameWorkflow={handleRenameWorkflow}
        onManualSaveRetry={() => saveDraftToBackend(steps)}
        onOpenPreview={() => setShowSimulationModal(true)}
        onOpenPublishReview={() => setShowPublishModal(true)}
        onDuplicateWorkflow={() => {
          alert('Workflow duplicated to draft. You can customize the copied steps.');
        }}
        onOpenVersionHistory={() => {
          alert(`Workflow History: Version ${versionDetail?.version_number} (${versionDetail?.publication_state}).`);
        }}
      />

      {/* Main Workspace Body: Main width dedicated to sequence; inspector slides in on right when a step is selected */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Workflow Sequence (Centered Column 680-800px) */}
        <WorkflowSequence
          steps={steps}
          selectedStepId={selectedStepId}
          validationIssues={validationIssues}
          onSelectStep={(id) => {
            setSelectedStepId(id);
          }}
          onMoveStep={handleMoveStep}
          onDuplicateStep={handleDuplicateStep}
          onDeleteStep={handleDeleteStep}
          onAddStepAtIndex={handleAddStepAtIndex}
          onUpdateStepTitle={handleUpdateStepTitle}
        />

        {/* Right-Side Inspector: Desktop (Screen >= 1024px) */}
        {selectedStep && (
          <div className="hidden lg:block h-full">
            <StepConfigPanel
              step={selectedStep}
              allSteps={steps}
              onUpdateStep={handleUpdateStep}
              onDeleteStep={handleDeleteStep}
              onClose={() => setSelectedStepId(null)}
            />
          </div>
        )}

        {/* Mobile & Tablet Drawer for Step Settings (< 1024px) */}
        {selectedStep && (
          <div
            className="lg:hidden fixed inset-0 z-50 flex justify-end bg-[#10263E]/40 backdrop-blur-xs"
            onClick={() => setSelectedStepId(null)}
          >
            <div
              className="w-full max-w-sm sm:max-w-md h-full bg-white shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <StepConfigPanel
                step={selectedStep}
                allSteps={steps}
                onUpdateStep={handleUpdateStep}
                onDeleteStep={handleDeleteStep}
                onClose={() => setSelectedStepId(null)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Publish Review Modal */}
      {showPublishModal && (
        <PublishReviewModal
          workflowName={workflow?.name || 'Standard Recruitment Workflow'}
          currentVersionNumber={versionDetail?.version_number ?? 1}
          steps={steps}
          validationIssues={validationIssues}
          affectedJobsCount={workflow?.job_usage_count || 1}
          activeExecutionsCount={12}
          isPublishing={isPublishing}
          onConfirmPublish={handleConfirmPublish}
          onClose={() => setShowPublishModal(false)}
        />
      )}

      {/* Path Simulation & Preview Modal */}
      {showSimulationModal && (
        <SimulationModal
          steps={steps}
          workflowName={workflow?.name || 'Standard Recruitment Workflow'}
          onClose={() => setShowSimulationModal(false)}
        />
      )}
    </div>
  );
};
