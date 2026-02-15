/**
 * Rich Text Editor Component (TipTap)
 *
 * A WYSIWYG editor built on TipTap with formatting toolbar.
 * Replaces the previous document.execCommand-based implementation.
 */

import { useState, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  id?: string;
  name?: string;
  label?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Start typing...",
  minHeight = 200,
  id,
  name,
  label,
}: RichTextEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hiddenInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = useCallback(
    ({ editor }: { editor: ReturnType<typeof useEditor> }) => {
      if (!editor) return;
      const html = editor.getHTML();
      // TipTap returns <p></p> for empty content; normalize to empty string
      const normalized = html === "<p></p>" ? "" : html;
      onChange(normalized);
    },
    [onChange],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3, 4],
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          class: "text-brand underline",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content: value || "",
    onUpdate: handleUpdate,
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label || "Rich text editor",
        "aria-multiline": "true",
        ...(id ? { id } : {}),
        class: `px-4 py-3 outline-none prose max-w-none text-foreground`,
        style: `min-height: ${minHeight}px`,
      },
    },
  });

  const handleFormatChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (!editor) return;
      const val = e.target.value;
      if (val === "p" || val === "") {
        editor.chain().focus().setParagraph().run();
      } else if (val === "h2") {
        editor.chain().focus().toggleHeading({ level: 2 }).run();
      } else if (val === "h3") {
        editor.chain().focus().toggleHeading({ level: 3 }).run();
      } else if (val === "h4") {
        editor.chain().focus().toggleHeading({ level: 4 }).run();
      }
      // Reset the select to allow re-selecting the same option
      e.target.value = "";
    },
    [editor],
  );

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    // If there's already a link, allow removing it
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = prompt("Enter URL:");
    if (url && /^https?:\/\//i.test(url)) {
      editor.chain().focus().setLink({ href: url }).run();
    } else if (url) {
      alert("Please enter a valid URL starting with http:// or https://");
    }
  }, [editor]);

  const getActiveFormatValue = useCallback(() => {
    if (!editor) return "";
    if (editor.isActive("heading", { level: 2 })) return "h2";
    if (editor.isActive("heading", { level: 3 })) return "h3";
    if (editor.isActive("heading", { level: 4 })) return "h4";
    return "";
  }, [editor]);

  const toolbarButtons = [
    {
      key: "bold",
      label: "B",
      title: "Bold",
      className: "font-bold",
      action: () => editor?.chain().focus().toggleBold().run(),
      isActive: () => editor?.isActive("bold") ?? false,
    },
    {
      key: "italic",
      label: "I",
      title: "Italic",
      className: "italic",
      action: () => editor?.chain().focus().toggleItalic().run(),
      isActive: () => editor?.isActive("italic") ?? false,
    },
    {
      key: "underline",
      label: "U",
      title: "Underline",
      className: "underline",
      action: () => editor?.chain().focus().toggleUnderline().run(),
      isActive: () => editor?.isActive("underline") ?? false,
    },
    {
      key: "bulletList",
      label: "\u2022",
      title: "Bullet List",
      className: "",
      action: () => editor?.chain().focus().toggleBulletList().run(),
      isActive: () => editor?.isActive("bulletList") ?? false,
    },
    {
      key: "orderedList",
      label: "1.",
      title: "Numbered List",
      className: "",
      action: () => editor?.chain().focus().toggleOrderedList().run(),
      isActive: () => editor?.isActive("orderedList") ?? false,
    },
    {
      key: "link",
      label: "Link",
      title: "Insert Link",
      className: "text-xs",
      action: handleSetLink,
      isActive: () => editor?.isActive("link") ?? false,
    },
  ];

  return (
    <div className="border rounded-lg overflow-hidden bg-surface-raised">
      {/* Toolbar */}
      <div
        className="flex items-center gap-1 p-2 bg-surface-inset border-b border-border"
        role="toolbar"
        aria-label="Text formatting"
      >
        {/* Format Dropdown */}
        <select
          className="px-2 py-1 border border-border-strong rounded text-sm bg-surface-raised text-foreground"
          onChange={handleFormatChange}
          value={getActiveFormatValue()}
          aria-label="Text format"
        >
          <option value="">Normal</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
          <option value="h4">Heading 4</option>
        </select>

        <div className="w-px h-6 bg-border-strong mx-1" aria-hidden="true" />

        {/* Formatting Buttons */}
        {toolbarButtons.map((button) => (
          <button
            key={button.key}
            type="button"
            title={button.title}
            aria-label={button.title}
            aria-pressed={button.isActive()}
            onClick={button.action}
            className={`px-3 py-1 rounded transition-colors ${button.className} ${
              button.isActive()
                ? "bg-surface-overlay text-brand"
                : "hover:bg-surface-overlay"
            }`}
            onMouseDown={(e) => e.preventDefault()}
          >
            {button.label}
          </button>
        ))}

        <div className="w-px h-6 bg-border-strong mx-1" aria-hidden="true" />

        {/* Alignment */}
        <button
          type="button"
          title="Align Left"
          aria-label="Align Left"
          onClick={() => editor?.chain().focus().setTextAlign("left").run()}
          className="px-3 py-1 rounded hover:bg-surface-overlay"
          onMouseDown={(e) => e.preventDefault()}
        >
          &#x2B05;
        </button>
        <button
          type="button"
          title="Align Center"
          aria-label="Align Center"
          onClick={() => editor?.chain().focus().setTextAlign("center").run()}
          className="px-3 py-1 rounded hover:bg-surface-overlay"
          onMouseDown={(e) => e.preventDefault()}
        >
          &#x2B0C;
        </button>
        <button
          type="button"
          title="Align Right"
          aria-label="Align Right"
          onClick={() => editor?.chain().focus().setTextAlign("right").run()}
          className="px-3 py-1 rounded hover:bg-surface-overlay"
          onMouseDown={(e) => e.preventDefault()}
        >
          &#x27A1;
        </button>
      </div>

      {/* Editor Area */}
      <div
        className={isFocused ? "ring-2 ring-brand ring-inset" : ""}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Hidden input for form submission */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value}
          ref={hiddenInputRef}
        />
      )}

      {/* Placeholder and prose styling for TipTap */}
      <style>{`
        .tiptap p.is-editor-empty:first-child::before {
          content: '${placeholder.replace(/'/g, "\\'")}';
          color: var(--foreground-subtle);
          pointer-events: none;
          float: left;
          height: 0;
        }
        .tiptap:focus {
          outline: none;
        }
        .tiptap ul {
          list-style-type: disc;
          padding-left: 1.5em;
        }
        .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.5em;
        }
        .tiptap h2 {
          font-size: 1.5em;
          font-weight: 700;
          margin-top: 0.5em;
          margin-bottom: 0.25em;
        }
        .tiptap h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-top: 0.5em;
          margin-bottom: 0.25em;
        }
        .tiptap h4 {
          font-size: 1.1em;
          font-weight: 600;
          margin-top: 0.5em;
          margin-bottom: 0.25em;
        }
        .tiptap p {
          margin-top: 0.25em;
          margin-bottom: 0.25em;
        }
        .tiptap a {
          color: var(--brand);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
