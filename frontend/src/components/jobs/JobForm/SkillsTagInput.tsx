import React, { useState } from 'react';
import { Plus, X, ArrowUp, ArrowDown } from 'lucide-react';
import { SkillItem } from '../../../types/job';

interface SkillsTagInputProps {
  skills: SkillItem[];
  onChange: (skills: SkillItem[]) => void;
  suggestedSkills?: string[];
}

export const SkillsTagInput: React.FC<SkillsTagInputProps> = ({
  skills,
  onChange,
  suggestedSkills = ['Python', 'React', 'TypeScript', 'Node.js', 'PostgreSQL', 'FastAPI', 'Docker', 'AWS', 'Kubernetes', 'SQL', 'Git']
}) => {
  const [reqInput, setReqInput] = useState('');
  const [prefInput, setPrefInput] = useState('');

  const requiredSkills = skills.filter((s) => s.category === 'required');
  const preferredSkills = skills.filter((s) => s.category === 'preferred');

  const addSkill = (name: string, category: 'required' | 'preferred') => {
    const cleanName = name.trim();
    if (!cleanName) return;

    // Case-insensitive deduplication check
    const exists = skills.some((s) => s.name.toLowerCase() === cleanName.toLowerCase());
    if (exists) return;

    const newSkill: SkillItem = {
      name: cleanName,
      category,
      position: skills.length + 1,
    };

    onChange([...skills, newSkill]);
    if (category === 'required') setReqInput('');
    else setPrefInput('');
  };

  const removeSkill = (name: string) => {
    onChange(skills.filter((s) => s.name.toLowerCase() !== name.toLowerCase()));
  };

  const moveSkill = (category: 'required' | 'preferred', index: number, direction: 'up' | 'down') => {
    const subset = category === 'required' ? [...requiredSkills] : [...preferredSkills];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= subset.length) return;

    const temp = subset[index];
    subset[index] = subset[targetIndex];
    subset[targetIndex] = temp;

    const otherSubset = category === 'required' ? preferredSkills : requiredSkills;
    onChange(category === 'required' ? [...subset, ...otherSubset] : [...otherSubset, ...subset]);
  };

  return (
    <div className="space-y-6">
      {/* Required Skills Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          Required Skills <span className="text-rose-500">*</span>
        </label>
        <p className="text-xs text-text-secondary">
          At least one required skill is required. Press Enter or comma to add.
        </p>

        <div className="flex gap-2">
          <input
            type="text"
            value={reqInput}
            onChange={(e) => setReqInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addSkill(reqInput, 'required');
              }
            }}
            placeholder="Add a required skill (e.g. Python, React)..."
            className="flex-1 px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:border-interactive-blue focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={() => addSkill(reqInput, 'required')}
            className="px-4 py-2 bg-nav-activeBg text-nav-activeText hover:bg-interactive-blue hover:text-surface text-sm font-medium rounded-item transition-colors"
          >
            Add
          </button>
        </div>

        {/* Required Skills Tags */}
        <div className="flex flex-wrap gap-2 pt-1">
          {requiredSkills.map((s, idx) => (
            <span
              key={s.name}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-nav-activeBg text-nav-activeText border border-blue-200 text-sm font-medium rounded-item"
            >
              <span>{s.name}</span>
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveSkill('required', idx, 'up')}
                  title="Move Up"
                  className="hover:text-brand-navy disabled:opacity-30 transition-opacity"
                >
                  <ArrowUp className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={idx === requiredSkills.length - 1}
                  onClick={() => moveSkill('required', idx, 'down')}
                  title="Move Down"
                  className="hover:text-brand-navy disabled:opacity-30 transition-opacity"
                >
                  <ArrowDown className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSkill(s.name)}
                  aria-label={`Remove skill ${s.name}`}
                  className="hover:text-rose-600 transition-colors ml-0.5"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </span>
          ))}
          {requiredSkills.length === 0 && (
            <span className="text-xs text-rose-500 italic">No required skills added yet.</span>
          )}
        </div>
      </div>

      {/* Preferred Skills Input */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-text-primary">
          Preferred Skills <span className="text-xs font-normal text-text-secondary">(Optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={prefInput}
            onChange={(e) => setPrefInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addSkill(prefInput, 'preferred');
              }
            }}
            placeholder="Add a preferred skill (e.g. Docker, AWS)..."
            className="flex-1 px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:border-interactive-blue focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={() => addSkill(prefInput, 'preferred')}
            className="px-4 py-2 bg-workspace border border-border-subtle hover:bg-nav-hover text-text-primary text-sm font-medium rounded-item transition-colors"
          >
            Add
          </button>
        </div>

        {/* Preferred Skills Tags */}
        <div className="flex flex-wrap gap-2 pt-1">
          {preferredSkills.map((s, idx) => (
            <span
              key={s.name}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-workspace text-text-primary border border-border-subtle text-sm font-medium rounded-item"
            >
              <span>{s.name}</span>
              <div className="flex items-center gap-0.5 ml-1">
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => moveSkill('preferred', idx, 'up')}
                  title="Move Up"
                  className="hover:text-brand-navy disabled:opacity-30 transition-opacity"
                >
                  <ArrowUp className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={idx === preferredSkills.length - 1}
                  onClick={() => moveSkill('preferred', idx, 'down')}
                  title="Move Down"
                  className="hover:text-brand-navy disabled:opacity-30 transition-opacity"
                >
                  <ArrowDown className="w-3 h-3" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => removeSkill(s.name)}
                  aria-label={`Remove skill ${s.name}`}
                  className="hover:text-rose-600 transition-colors ml-0.5"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </span>
          ))}
        </div>
      </div>

      {/* Suggested Skills Suggestions */}
      {suggestedSkills.length > 0 && (
        <div className="pt-2">
          <span className="text-xs font-medium text-text-secondary block mb-1.5">
            Quick Add Suggestions:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {suggestedSkills
              .filter((s) => !skills.some((sk) => sk.name.toLowerCase() === s.toLowerCase()))
              .map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addSkill(s, 'required')}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-workspace hover:bg-nav-hover border border-border-subtle text-text-secondary hover:text-text-primary rounded-item transition-colors"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                  <span>{s}</span>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
