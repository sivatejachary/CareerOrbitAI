import { useCallback, useEffect, useState } from 'react';
import { communicationApi, type CompanyCommunicationSettings } from '../api/communicationApi';
import { aiCallingApi } from '../api/aiCallingApi';
import { Button, ErrorState, LoadingState, PageHeading, StatusBadge } from './ui/Workspace';

export function SettingsPage() {
  const [settings, setSettings] = useState<CompanyCommunicationSettings | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setError('');
    try { setSettings(await communicationApi.getCompanySettings()); } catch { setError('Unable to load communication settings.'); }
    try { setReady((await aiCallingApi.checkReadiness()).ready); } catch { setReady(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const update = (values: Partial<CompanyCommunicationSettings>) => { setSettings(s => s ? { ...s, ...values } : s); setSaved(false); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!settings) return;
    try { new Intl.DateTimeFormat(undefined, { timeZone: settings.timezone }); } catch { setError('Enter a valid timezone, for example Asia/Kolkata.'); return; }
    setSaving(true); setError(''); setSaved(false);
    try { setSettings(await communicationApi.updateCompanySettings(settings)); setSaved(true); } catch { setError('Settings could not be saved. Your changes are still here.'); } finally { setSaving(false); }
  };
  return <div className="workspace-page"><PageHeading title="Settings" description="Set the defaults your team uses when contacting candidates." />
    {error && <ErrorState message={error} onRetry={!settings ? load : undefined} />}
    {!settings ? !error && <LoadingState /> : <form onSubmit={save} className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
      <section className="ui-panel"><div className="section-heading"><h2>Candidate communication</h2></div><div className="p-6 space-y-5">
        <label className="ui-field">Company introduction<textarea className="ui-input" rows={3} value={settings.company_intro} onChange={e => update({ company_intro: e.target.value })} placeholder="How should the AI introduce your company?" /></label>
        <div className="grid sm:grid-cols-2 gap-4"><label className="ui-field">Conversation tone<input required className="ui-input" value={settings.tone} onChange={e => update({ tone: e.target.value })} /></label><label className="ui-field">Timezone<input required className="ui-input" value={settings.timezone} onChange={e => update({ timezone: e.target.value })} placeholder="Asia/Kolkata" /></label></div>
        <fieldset><legend className="font-semibold text-sm mb-3">Calling hours</legend><div className="grid sm:grid-cols-2 gap-4"><label className="ui-field">From<input required type="time" className="ui-input" value={settings.calling_hours_start} onChange={e => update({ calling_hours_start: e.target.value })} /></label><label className="ui-field">Until<input required type="time" className="ui-input" value={settings.calling_hours_end} onChange={e => update({ calling_hours_end: e.target.value })} /></label></div><p className="text-xs text-text-secondary mt-2">Times use your company timezone.</p></fieldset>
        <div className="grid sm:grid-cols-2 gap-4"><label className="ui-field">Maximum retry attempts<input required type="number" min={0} max={10} className="ui-input" value={settings.max_retry_attempts} onChange={e => update({ max_retry_attempts: Number(e.target.value) })} /></label><label className="ui-field">Hours between calls<input required type="number" min={1} className="ui-input" value={settings.min_hours_between_calls} onChange={e => update({ min_hours_between_calls: Number(e.target.value) })} /></label></div>
      </div><div className="border-t border-border-subtle p-5 flex flex-wrap items-center justify-between gap-3"><span role="status" className="text-success text-sm">{saved ? 'Settings saved.' : ''}</span><Button type="submit" variant="primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button></div></section>
      <aside className="ui-panel"><div className="section-heading"><h2>AI calling integration</h2></div><div className="p-5 space-y-3"><StatusBadge value={ready === null ? 'Unknown' : ready ? 'Configured' : 'Setup required'} /><p className="text-sm text-text-secondary">{ready ? 'Calling credentials are configured. Provider connectivity is checked when a call is started.' : 'Ask your administrator to configure the voice provider and phone number before starting calls.'}</p></div></aside>
    </form>}
  </div>;
}
