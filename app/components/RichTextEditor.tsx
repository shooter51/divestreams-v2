/**
 * Simple Rich Text Editor Component
 *
 * A basic WYSIWYG editor with formatting toolbar.
 * This is a minimal implementation that can be replaced with a more
 * sophisticated editor (like Lexical or TipTap) in the future.
 */

import { useState, useRef, useEffect } from "react";

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  id?: string;
  name?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = 200,
  id,
  name,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const buttons = [
    {
      label: "B",
      title: "Bold",
      command: "bold",
      className: "font-bold",
    },
    {
      label: "I",
      title: "Italic",
      command: "italic",
      className: "italic",
    },
    {
      label: "U",
      title: "Underline",
      command: "underline",
      className: "underline",
    },
    {
      label: "•",
      title: "Bullet List",
      command: "insertUnorderedList",
      className: "",
    },
    {
      label: "1.",
      title: "Numbered List",
      command: "insertOrderedList",
      className: "",
    },
    {
      label: "Link",
      title: "Insert Link",
      command: "createLink",
      className: "text-xs",
      onClick: () => {
        const url = prompt("Enter URL:");
        if (url) {
          execCommand("createLink", url);
        }
      },
    },
  ];

  return (
    <div className="border rounded-lg overflow-hidden bg-surface-raised">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-surface-inset border-b border-border">
        {/* Format Dropdown */}
        <select
          className="px-2 py-1 border border-border-strong rounded text-sm bg-surface-raised text-foreground"
          onChange={(e) => execCommand("formatBlock", e.target.value)}
          defaultValue=""
        >
          <option value="">Normal</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
          <option value="p">Paragraph</option>
        </select>

        <div className="w-px h-6 bg-border-strong mx-1" />

        {/* Formatting Buttons */}
        {buttons.map((button) => (
          <button
            key={button.command}
            type="button"
            title={button.title}
            onClick={button.onClick || (() => execCommand(button.command))}
            className={`px-3 py-1 rounded hover:bg-surface-overlay transition-colors ${button.className}`}
            onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
          >
            {button.label}
          </button>
        ))}

        <div className="w-px h-6 bg-border-strong mx-1" />

        {/* Alignment */}
        <button
          type="button"
          title="Align Left"
          onClick={() => execCommand("justifyLeft")}
          className="px-3 py-1 rounded hover:bg-surface-overlay"
          onMouseDown={(e) => e.preventDefault()}
        >
          ⬅
        </button>
        <button
          type="button"
          title="Align Center"
          onClick={() => execCommand("justifyCenter")}
          className="px-3 py-1 rounded hover:bg-surface-overlay"
          onMouseDown={(e) => e.preventDefault()}
        >
          ⬌
        </button>
        <button
          type="button"
          title="Align Right"
          onClick={() => execCommand("justifyRight")}
          className="px-3 py-1 rounded hover:bg-surface-overlay"
          onMouseDown={(e) => e.preventDefault()}
        >
          ➡
        </button>
      </div>

      {/* Editor Area */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className={`px-4 py-3 outline-none prose max-w-none ${
          isFocused ? "ring-2 ring-brand ring-inset" : ""
        }`}
        style={{ minHeight: `${minHeight}px` }}
        data-placeholder={placeholder}
        id={id}
        suppressContentEditableWarning
      />

      {/* Hidden input for form submission */}
      {name && <input type="hidden" name={name} value={value} />}

      <style>{`
        [contentEditable=true]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contentEditable=true]:focus:before {
          content: "";
        }
      `}</style>
    </div>
  );
}
