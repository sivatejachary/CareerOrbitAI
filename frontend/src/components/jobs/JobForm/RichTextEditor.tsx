import React from 'react';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon, Type } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, id }) => {
  const insertFormatting = (tagStart: string, tagEnd: string) => {
    const textarea = document.getElementById(id || 'rich-text-input') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const replacement = `${tagStart}${selectedText || 'Text'}${tagEnd}`;
    const newValue = value.substring(0, start) + replacement + value.substring(end);

    onChange(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tagStart.length, end + tagStart.length);
    }, 0);
  };

  return (
    <div className="border border-border-subtle rounded-item overflow-hidden bg-surface focus-within:ring-2 focus-within:ring-interactive-blue focus-within:border-interactive-blue transition-colors">
      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-workspace border-b border-border-subtle text-text-secondary select-none">
        <button
          type="button"
          onClick={() => insertFormatting('<p>', '</p>')}
          title="Paragraph"
          className="p-1.5 hover:bg-surface hover:text-text-primary rounded transition-colors"
        >
          <Type className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('<h2>', '</h2>')}
          title="Heading 2"
          className="p-1.5 hover:bg-surface hover:text-text-primary rounded transition-colors font-semibold text-xs"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('<h3>', '</h3>')}
          title="Heading 3"
          className="p-1.5 hover:bg-surface hover:text-text-primary rounded transition-colors font-semibold text-xs"
        >
          H3
        </button>
        <div className="w-px h-4 bg-border-subtle mx-1" aria-hidden="true" />
        <button
          type="button"
          onClick={() => insertFormatting('<strong>', '</strong>')}
          title="Bold"
          className="p-1.5 hover:bg-surface hover:text-text-primary rounded transition-colors"
        >
          <Bold className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('<em>', '</em>')}
          title="Italic"
          className="p-1.5 hover:bg-surface hover:text-text-primary rounded transition-colors"
        >
          <Italic className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className="w-px h-4 bg-border-subtle mx-1" aria-hidden="true" />
        <button
          type="button"
          onClick={() => insertFormatting('<ul>\n  <li>', '</li>\n</ul>')}
          title="Bullet List"
          className="p-1.5 hover:bg-surface hover:text-text-primary rounded transition-colors"
        >
          <List className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('<ol>\n  <li>', '</li>\n</ol>')}
          title="Numbered List"
          className="p-1.5 hover:bg-surface hover:text-text-primary rounded transition-colors"
        >
          <ListOrdered className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => insertFormatting('<a href="https://">', '</a>')}
          title="Add Link"
          className="p-1.5 hover:bg-surface hover:text-text-primary rounded transition-colors"
        >
          <LinkIcon className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Editor Input Area */}
      <textarea
        id={id || 'rich-text-input'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={8}
        placeholder="Provide a detailed job description, overview, core tasks, and company context..."
        className="w-full p-3.5 text-sm bg-surface border-0 focus:outline-none font-mono text-text-primary leading-relaxed resize-y"
      />
    </div>
  );
};
