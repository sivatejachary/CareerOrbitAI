import React, { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';

interface ResponsibilitiesEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
}

export const ResponsibilitiesEditor: React.FC<ResponsibilitiesEditorProps> = ({ items, onChange }) => {
  const [newItem, setNewItem] = useState('');

  const handleAdd = () => {
    const clean = newItem.trim();
    if (!clean) return;
    onChange([...items, clean]);
    setNewItem('');
  };

  const handleRemove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= items.length) return;
    const updated = [...items];
    const temp = updated[index];
    updated[index] = updated[target];
    updated[target] = temp;
    onChange(updated);
  };

  const handleItemChange = (index: number, val: string) => {
    const updated = [...items];
    updated[index] = val;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-text-primary">
          Key Responsibilities <span className="text-rose-500">*</span>
        </label>
        <span className="text-xs text-text-secondary">At least one item required</span>
      </div>

      {/* Bullet List Items */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-text-secondary text-sm font-bold select-none w-4 text-center">•</span>
            <input
              type="text"
              value={item}
              onChange={(e) => handleItemChange(idx, e.target.value)}
              placeholder="e.g. Design and build high-throughput microservices..."
              className="flex-1 px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:border-interactive-blue focus:outline-none transition-colors"
            />
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => handleMove(idx, 'up')}
                title="Move Up"
                className="p-1.5 text-text-secondary hover:text-text-primary border border-border-subtle rounded-item disabled:opacity-30 transition-colors"
              >
                <ArrowUp className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                disabled={idx === items.length - 1}
                onClick={() => handleMove(idx, 'down')}
                title="Move Down"
                className="p-1.5 text-text-secondary hover:text-text-primary border border-border-subtle rounded-item disabled:opacity-30 transition-colors"
              >
                <ArrowDown className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => handleRemove(idx)}
                title="Delete item"
                className="p-1.5 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-item transition-colors"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add New Item Input */}
      <div className="flex gap-2 pt-1">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
          placeholder="Add a new responsibility bullet point..."
          className="flex-1 px-3.5 py-2 text-sm bg-surface border border-border-subtle rounded-item focus:ring-2 focus:ring-interactive-blue focus:border-interactive-blue focus:outline-none transition-colors"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-workspace border border-border-subtle hover:bg-nav-hover text-text-primary text-sm font-medium rounded-item transition-colors"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Bullet</span>
        </button>
      </div>

      {items.length === 0 && (
        <p className="text-xs text-rose-500 italic">Please add at least one key responsibility.</p>
      )}
    </div>
  );
};
