import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { RoutePlaceholder } from './components/RoutePlaceholder';
import { JobsList } from './components/jobs/JobsList';
import { JobForm } from './components/jobs/JobForm/JobForm';
import { JobDetails } from './components/jobs/JobDetails/JobDetails';
import { CandidatesPage } from './components/candidates/CandidatesPage';
import { CareerPage } from './components/careers/CareerPage';
import { PublicApplicationPage } from './components/careers/PublicApplicationPage';
import { WorkflowList } from './components/workflow/WorkflowList';
import { WorkflowEditor } from './components/workflow/WorkflowEditor/WorkflowEditor';
import { WorkflowExecutionDetail } from './components/workflow/WorkflowExecutionDetail';
import { AICallingWorkspace } from './components/aiCalling/AICallingWorkspace';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Application Form & Career Portal (No AppShell) */}
        <Route path="/apply/:jobCode/:token" element={<PublicApplicationPage />} />
        <Route path="/careers/:jobCode" element={<CareerPage />} />

        {/* HR Dashboard & Internal Application Shell */}
        <Route
          path="/*"
          element={
            <AppShell>
              <Routes>
                {/* Redirect root to /jobs */}
                <Route path="/" element={<Navigate to="/jobs" replace />} />
                <Route path="/dashboard" element={<RoutePlaceholder />} />

                {/* Jobs Routes */}
                <Route path="/jobs" element={<JobsList />} />
                <Route path="/jobs/create" element={<JobForm mode="create" />} />
                <Route path="/jobs/:jobId" element={<JobDetails />} />
                <Route path="/jobs/:jobId/edit" element={<JobForm mode="edit" />} />

                {/* Candidates Workspace */}
                <Route path="/candidates" element={<CandidatesPage />} />
                <Route path="/candidates/:candidateId" element={<CandidatesPage />} />

                {/* Workflow Module */}
                <Route path="/workflow" element={<WorkflowList />} />
                <Route path="/workflow/new" element={<WorkflowList />} />
                <Route path="/workflow/:workflowId" element={<WorkflowEditor />} />
                <Route path="/workflow/:workflowId/versions/:versionId" element={<WorkflowEditor />} />
                <Route path="/workflow/executions/:executionId" element={<WorkflowExecutionDetail />} />

                {/* AI Calling Workspace */}
                <Route path="/ai-calling" element={<AICallingWorkspace />} />
                <Route path="/ai-calling/:callId" element={<AICallingWorkspace />} />

                {/* Other Module Placeholders */}
                <Route path="/ai-interviews" element={<RoutePlaceholder />} />
                <Route path="/settings" element={<RoutePlaceholder />} />

                {/* Catch-all fallback */}
                <Route path="*" element={<Navigate to="/jobs" replace />} />
              </Routes>
            </AppShell>
          }
        />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
