import {
  WorkflowGraph,
  WorkflowNodeData,
  WorkflowEdgeData,
  WorkflowStepItem,
  ConditionBranchItem,
  StepValidationIssue,
  WorkflowNodeType
} from '../../../types/workflow';

export const DEFAULT_PURPOSES: Record<WorkflowNodeType, string> = {
  APPLICATION_RECEIVED: 'Captures and verifies candidate applications from website and connected Google Forms.',
  AI_RESUME_SCREENING: 'Evaluates resume skills, verified experience, and role qualifications against job requirements.',
  HR_REVIEW: 'Assigns an HR recruiter to inspect candidate qualifications and record an authorized decision.',
  INTERVIEW: 'Coordinates and conducts an interview round (technical, hiring manager, or panel).',
  ASSESSMENT: 'Administers an online skill evaluation or coding challenge.',
  AI_CALLING: 'Engages the candidate in an automated voice conversation with explicit hiring purpose.',
  SCHEDULE_INTERVIEW: 'Coordinates calendar availability and books interview slots without double-booking.',
  CANDIDATE_AVAILABILITY: 'Collects available timeslots from the candidate for upcoming interview rounds.',
  SEND_MESSAGE: 'Dispatches automated email or SMS notifications regarding application milestones.',
  WAIT_DELAY: 'Pauses hiring progression for a set window to allow review or candidate response.',
  CONDITION: 'Routes candidates down different paths based on transparent, objective criteria.',
  MANUAL_TASK: 'Assigns operational checklists such as background verification or reference checks.',
  HR_FINAL_DECISION: 'Enforces human recruiter authorization before generating offer letters or rejections.',
  END: 'Marks the formal conclusion of the hiring journey for this candidate.'
};

/**
 * Converts a backend WorkflowGraph (DAG of nodes & edges) into a sequential step list with branches.
 */
export function graphToWorkflowSteps(graph: WorkflowGraph | null | undefined): WorkflowStepItem[] {
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return [
      {
        id: 'step_apply',
        type: 'APPLICATION_RECEIVED',
        title: 'Candidate applies',
        purpose: DEFAULT_PURPOSES.APPLICATION_RECEIVED,
        config: {}
      },
      {
        id: 'step_screen',
        type: 'AI_RESUME_SCREENING',
        title: 'Screen resume',
        purpose: DEFAULT_PURPOSES.AI_RESUME_SCREENING,
        config: { min_score_shortlist: 75, min_score_review: 50, require_experience_match: true }
      },
      {
        id: 'step_decision',
        type: 'HR_FINAL_DECISION',
        title: 'Final hiring decision',
        purpose: DEFAULT_PURPOSES.HR_FINAL_DECISION,
        config: { title: 'Final Hiring Decision', allowed_outcomes: ['OFFER', 'REJECT', 'HOLD'] }
      },
      {
        id: 'step_end',
        type: 'END',
        title: 'End process',
        purpose: DEFAULT_PURPOSES.END,
        config: {}
      }
    ];
  }

  const nodeMap = new Map<string, WorkflowNodeData>();
  graph.nodes.forEach(n => nodeMap.set(n.id, n));

  const outgoingEdges = new Map<string, WorkflowEdgeData[]>();
  (graph.edges || []).forEach(e => {
    const list = outgoingEdges.get(e.source) || [];
    list.push(e);
    outgoingEdges.set(e.source, list);
  });

  // Find start node
  const startNode = graph.nodes.find(n => n.type === 'APPLICATION_RECEIVED') || graph.nodes[0];

  // Helper to construct step
  const makeStep = (n: WorkflowNodeData): WorkflowStepItem => {
    let purpose = n.description || DEFAULT_PURPOSES[n.type] || 'Hiring workflow step';
    const step: WorkflowStepItem = {
      id: n.id,
      type: n.type,
      title: n.title || n.type.replace(/_/g, ' '),
      purpose,
      description: n.description,
      config: { ...(n.config || {}) }
    };

    if (n.type === 'CONDITION') {
      const branches: ConditionBranchItem[] = [];
      const outEdges = outgoingEdges.get(n.id) || [];

      // Check if node has config branches
      const cfgBranches = n.config?.branches;
      if (Array.isArray(cfgBranches) && cfgBranches.length > 0) {
        cfgBranches.forEach((b: any, bIdx: number) => {
          const isDef = b.is_default || bIdx === cfgBranches.length - 1;
          const matchingEdge = outEdges.find(e =>
            e.source_handle === (b.branch_name || b.id) ||
            (isDef && (e.source_handle === 'DEFAULT' || e.source_handle === 'else'))
          );
          const subSteps: WorkflowStepItem[] = [];
          if (matchingEdge && matchingEdge.target) {
            const targetNode = nodeMap.get(matchingEdge.target);
            if (targetNode && targetNode.type !== 'END' && targetNode.type !== 'HR_FINAL_DECISION') {
              subSteps.push(makeStep(targetNode));
            }
          }

          branches.push({
            id: b.id || `branch_${bIdx + 1}`,
            name: b.branch_name || (isDef ? 'Otherwise' : `Branch ${bIdx + 1}`),
            is_default: isDef,
            condition_logic: b.condition_logic || 'AND',
            rules: (b.rules || []).map((r: any, rIdx: number) => ({
              id: `r_${rIdx + 1}`,
              field: r.field_path || r.field || 'screening.score',
              operator: r.operator || 'greater_than_or_equal',
              value: r.value ?? 75
            })),
            missing_data_action: b.missing_data_action || 'PAUSE_FOR_RECRUITER',
            rejoin_type: b.rejoin_type || 'REJOIN_MAIN',
            sub_steps: subSteps
          });
        });
      } else {
        // Build branches from outgoing edges
        outEdges.forEach((e, idx) => {
          const isDef = e.source_handle === 'DEFAULT' || e.source_handle === 'else' || idx === outEdges.length - 1;
          let bName = 'Meets shortlist policy';
          if (e.source_handle === 'SHORTLIST') bName = 'Meets shortlist policy';
          else if (e.source_handle === 'REVIEW') bName = 'Needs recruiter review';
          else if (isDef) bName = 'Otherwise';
          else if (e.label) bName = e.label;

          const subSteps: WorkflowStepItem[] = [];
          const targetNode = nodeMap.get(e.target);
          if (targetNode && targetNode.type !== 'END' && targetNode.type !== 'HR_FINAL_DECISION') {
            subSteps.push(makeStep(targetNode));
          }

          branches.push({
            id: `branch_${idx + 1}`,
            name: bName,
            is_default: isDef,
            condition_logic: 'AND',
            rules: isDef ? [] : [
              {
                id: `r_${idx}`,
                field: 'screening.score',
                operator: 'greater_than_or_equal',
                value: 75
              }
            ],
            missing_data_action: 'PAUSE_FOR_RECRUITER',
            rejoin_type: 'REJOIN_MAIN',
            sub_steps: subSteps
          });
        });

        if (!branches.some(b => b.is_default)) {
          branches.push({
            id: 'branch_def',
            name: 'Otherwise',
            is_default: true,
            condition_logic: 'AND',
            rules: [],
            missing_data_action: 'PAUSE_FOR_RECRUITER',
            rejoin_type: 'REJOIN_MAIN',
            sub_steps: []
          });
        }
      }
      step.branches = branches;
    }

    return step;
  };

  // Traversal to build main sequence
  const result: WorkflowStepItem[] = [];
  const visited = new Set<string>();

  // Collect branch sub-step IDs so they aren't duplicated at top level
  const branchSubStepIds = new Set<string>();

  let curr: WorkflowNodeData | undefined = startNode;
  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    const step = makeStep(curr);
    result.push(step);

    if (step.branches) {
      step.branches.forEach(b => {
        b.sub_steps.forEach(sub => branchSubStepIds.add(sub.id));
      });
    }

    // Determine next main node
    const currEdges: WorkflowEdgeData[] = outgoingEdges.get(curr.id) || [];
    if (curr.type === 'CONDITION') {
      // Find convergence node after condition
      let nextMainId: string | null = null;
      for (const e of currEdges) {
        // If edge points to node not in sub_steps
        if (!branchSubStepIds.has(e.target)) {
          nextMainId = e.target;
          break;
        }
        // Or inspect outgoing of sub-step
        const subOut = outgoingEdges.get(e.target) || [];
        if (subOut.length > 0 && !branchSubStepIds.has(subOut[0].target)) {
          nextMainId = subOut[0].target;
          break;
        }
      }
      curr = nextMainId ? nodeMap.get(nextMainId) : undefined;
    } else {
      const nextEdge = currEdges[0];
      curr = nextEdge ? nodeMap.get(nextEdge.target) : undefined;
    }
  }

  // Filter out any accidentally visited branch sub-steps from top level
  const filtered = result.filter((s, idx) => idx === 0 || !branchSubStepIds.has(s.id));

  // Ensure 'END' step is at the end
  if (!filtered.some(s => s.type === 'END')) {
    filtered.push({
      id: `node_end_${Date.now().toString().slice(-4)}`,
      type: 'END',
      title: 'End process',
      purpose: DEFAULT_PURPOSES.END,
      config: {}
    });
  }

  return filtered;
}

/**
 * Converts sequential steps with branches back into a valid DAG WorkflowGraph for backend storage.
 */
export function workflowStepsToGraph(steps: WorkflowStepItem[]): WorkflowGraph {
  const nodes: WorkflowNodeData[] = [];
  const edges: WorkflowEdgeData[] = [];

  let yOffset = 100;
  const X_CENTER = 260;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const nextStep = i < steps.length - 1 ? steps[i + 1] : null;

    // Add main node
    nodes.push({
      id: step.id,
      type: step.type,
      title: step.title,
      description: step.purpose || step.description,
      position: { x: X_CENTER, y: yOffset },
      config: { ...step.config }
    });
    yOffset += 140;

    if (step.type === 'CONDITION' && step.branches && step.branches.length > 0) {
      // Build condition node config
      step.config.branches = step.branches.map(b => ({
        branch_name: b.name,
        is_default: b.is_default,
        condition_logic: b.condition_logic,
        rules: b.rules.map(r => ({
          field_path: r.field,
          operator: r.operator,
          value: r.value
        })),
        missing_data_action: b.missing_data_action,
        rejoin_type: b.rejoin_type
      }));

      // For each branch
      step.branches.forEach((b, bIdx) => {
        const handle = b.is_default ? 'DEFAULT' : (b.name === 'Meets shortlist policy' ? 'SHORTLIST' : `BRANCH_${bIdx + 1}`);

        if (b.sub_steps.length > 0) {
          // Sub-steps positioned laterally
          const branchX = X_CENTER + (bIdx === 0 ? -160 : (bIdx === 1 ? 160 : 0));
          let subY = yOffset;

          b.sub_steps.forEach((sub, sIdx) => {
            nodes.push({
              id: sub.id,
              type: sub.type,
              title: sub.title,
              description: sub.purpose,
              position: { x: branchX, y: subY },
              config: { ...sub.config }
            });
            subY += 120;

            if (sIdx === 0) {
              edges.push({
                id: `e_${step.id}_${sub.id}`,
                source: step.id,
                target: sub.id,
                source_handle: handle,
                label: b.name
              });
            } else {
              edges.push({
                id: `e_${b.sub_steps[sIdx - 1].id}_${sub.id}`,
                source: b.sub_steps[sIdx - 1].id,
                target: sub.id,
                label: 'Proceed'
              });
            }
          });

          // Connect last sub-step
          const lastSub = b.sub_steps[b.sub_steps.length - 1];
          if (b.rejoin_type === 'END_PATH') {
            // Find or link to terminal end
            const endNode = steps.find(s => s.type === 'END') || nextStep;
            if (endNode) {
              edges.push({
                id: `e_${lastSub.id}_${endNode.id}`,
                source: lastSub.id,
                target: endNode.id,
                label: 'End path'
              });
            }
          } else if (nextStep) {
            edges.push({
              id: `e_${lastSub.id}_${nextStep.id}`,
              source: lastSub.id,
              target: nextStep.id,
              label: 'Rejoin process'
            });
          }
        } else {
          // No sub-steps in branch: direct link to nextStep or End
          if (nextStep) {
            edges.push({
              id: `e_${step.id}_${nextStep.id}_${bIdx}`,
              source: step.id,
              target: nextStep.id,
              source_handle: handle,
              label: b.name
            });
          }
        }
      });
    } else if (nextStep) {
      // Standard linear transition
      edges.push({
        id: `e_${step.id}_${nextStep.id}`,
        source: step.id,
        target: nextStep.id,
        label: 'Proceed'
      });
    }
  }

  return { nodes, edges };
}

/**
 * Validates dependencies and identifies blocking setup issues for HR users.
 */
export function validateStepDependencies(steps: WorkflowStepItem[]): StepValidationIssue[] {
  const issues: StepValidationIssue[] = [];

  // Check 1: Start node
  if (steps.length === 0 || steps[0].type !== 'APPLICATION_RECEIVED') {
    issues.push({
      stepId: steps[0]?.id || 'start',
      stepTitle: steps[0]?.title || 'Start',
      message: 'Workflow must start with the pinned "Candidate applies" intake step.',
      severity: 'error'
    });
  }

  // Check 2: Terminal node
  const hasEnd = steps.some(s => s.type === 'END');
  if (!hasEnd) {
    issues.push({
      stepId: steps[steps.length - 1]?.id || 'end',
      stepTitle: steps[steps.length - 1]?.title || 'End',
      message: 'Workflow must end with an "End process" step.',
      severity: 'error'
    });
  }

  // Track earlier step types for dependency validation
  const priorTypes: WorkflowNodeType[] = [];

  steps.forEach((step) => {
    // 1. AI Calling validation
    if (step.type === 'AI_CALLING') {
      const purpose = step.config?.purpose || 'INITIAL_SCREENING';

      // Needs approval check for result calls
      if (['RESULT_NOTIFICATION', 'RESULT_AND_SCHEDULING', 'FINAL_SELECTION_NOTIFICATION'].includes(purpose)) {
        const hasPriorEvaluation = priorTypes.includes('HR_REVIEW') || priorTypes.includes('INTERVIEW') || priorTypes.includes('AI_RESUME_SCREENING');
        if (!hasPriorEvaluation) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            message: 'Needs setup: Result announcement call cannot run before an interview or screening step.',
            severity: 'error'
          });
        }
        if (!step.config?.required_approval) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            message: 'Needs setup: Result announcement calls require human recruiter approval before dialing.',
            severity: 'error'
          });
        }
      }

      // Check template brackets
      const tpl = step.config?.first_message_template || '';
      if (tpl.includes('{{') && tpl.split('{{').length !== tpl.split('}}').length) {
        issues.push({
          stepId: step.id,
          stepTitle: step.title,
          message: 'Needs setup: Malformed variable brackets in opening call message (e.g. mismatched {{ or }}).',
          severity: 'error'
        });
      }
    }

    // 2. Condition validation
    if (step.type === 'CONDITION') {
      if (!step.branches || step.branches.length === 0) {
        issues.push({
          stepId: step.id,
          stepTitle: step.title,
          message: 'Needs setup: Condition must have at least one policy branch.',
          severity: 'error'
        });
      } else {
        const hasDefault = step.branches.some(b => b.is_default);
        if (!hasDefault) {
          issues.push({
            stepId: step.id,
            stepTitle: step.title,
            message: 'Needs setup: Condition requires a mandatory "Otherwise" fallback branch.',
            severity: 'error'
          });
        }
      }
    }

    // 3. Setup required for external integrations
    if (step.type === 'ASSESSMENT' && !step.config?.assessment_url && !step.config?.provider) {
      issues.push({
        stepId: step.id,
        stepTitle: step.title,
        message: 'Setup required: Add a test challenge link or connect an assessment platform.',
        severity: 'warning'
      });
    }

    if (step.type === 'SEND_MESSAGE' && !step.config?.template_content) {
      issues.push({
        stepId: step.id,
        stepTitle: step.title,
        message: 'Setup required: Define email or SMS message template.',
        severity: 'warning'
      });
    }

    priorTypes.push(step.type);
  });

  return issues;
}
