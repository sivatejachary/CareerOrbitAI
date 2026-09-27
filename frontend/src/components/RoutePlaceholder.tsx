import { Link } from 'react-router-dom';
import { EmptyState, PageHeading } from './ui/Workspace';
export function RoutePlaceholder() {
  return <div className="workspace-page"><PageHeading title="AI interviews" description="Interview questions, responses and evaluations." /><section className="ui-panel"><EmptyState title="AI interviews are not available yet" description="This workspace does not have a connected AI interview service. You can review booked interviews and AI screening calls in the meantime." action={<div className="flex flex-wrap justify-center gap-3"><Link to="/interviews" className="ui-button ui-button-secondary">View interviews</Link><Link to="/ai-calling" className="ui-button ui-button-primary">Review AI calls</Link></div>} /></section></div>;
}
