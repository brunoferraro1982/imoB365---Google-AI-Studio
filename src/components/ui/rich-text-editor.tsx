import { useEffect } from "react";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  Link as LinkIcon,
} from "lucide-react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import TiptapUnderline from "@tiptap/extension-underline";
import TiptapLink from "@tiptap/extension-link";

interface ToolbarBtnProps {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarBtn({ onClick, active, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={[
        "flex h-7 min-w-[28px] select-none items-center justify-center rounded px-1.5 text-sm transition-colors",
        active
          ? "bg-primary/15 text-primary ring-1 ring-primary/30"
          : "text-foreground hover:bg-accent hover:text-accent-foreground",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  footer?: React.ReactNode;
}

/**
 * Editor visual (WYSIWYG) para conteúdo que vai virar HTML público — pensado
 * para quem não sabe escrever HTML: nunca expõe a marcação, só formatação
 * visual (negrito, títulos, listas, links, alinhamento).
 */
export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escreva aqui…",
  minHeight = 220,
  footer,
}: RichTextEditorProps) {
  useEffect(() => {
    const STYLE_ID = "rich-text-editor-prose";
    if (document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
      .rich-text-editor .ProseMirror { outline: none; padding: 16px; font-size: 14px; line-height: 1.7; color: inherit; }
      .rich-text-editor .ProseMirror h1 { font-size: 1.4rem; font-weight: 700; margin: 0 0 12px; }
      .rich-text-editor .ProseMirror h2 { font-size: 1.15rem; font-weight: 700; margin: 18px 0 8px; }
      .rich-text-editor .ProseMirror h3 { font-size: 1rem; font-weight: 600; margin: 14px 0 6px; }
      .rich-text-editor .ProseMirror p { margin: 0 0 10px; }
      .rich-text-editor .ProseMirror ul { list-style: disc; padding-left: 24px; margin: 0 0 10px; }
      .rich-text-editor .ProseMirror ol { list-style: decimal; padding-left: 24px; margin: 0 0 10px; }
      .rich-text-editor .ProseMirror li { margin-bottom: 4px; }
      .rich-text-editor .ProseMirror a { color: var(--primary); text-decoration: underline; }
      .rich-text-editor .ProseMirror strong { font-weight: 700; }
      .rich-text-editor .ProseMirror em { font-style: italic; }
      .rich-text-editor .ProseMirror u { text-decoration: underline; }
      .rich-text-editor .ProseMirror p.is-editor-empty:first-child::before {
        content: attr(data-placeholder); color: #9ca3af; pointer-events: none; float: left; height: 0;
      }
    `;
    document.head.appendChild(el);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TiptapUnderline,
      TiptapLink.configure({ openOnClick: false, autolink: true }),
    ],
    content: value || "<p></p>",
    editorProps: { attributes: { "data-placeholder": placeholder } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  function setLink() {
    const previous = editor?.getAttributes("link").href as string | undefined;
    const url = window.prompt("Endereço do link (https://…)", previous || "https://");
    if (url === null) return;
    if (url === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }

  return (
    <div className="rich-text-editor overflow-hidden rounded-lg border border-input shadow-xs">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/50 px-2 py-1.5">
        <ToolbarBtn
          title="Negrito"
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Itálico"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Sublinhado"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="mx-1.5 h-5 w-px bg-border" />

        <ToolbarBtn
          title="Título grande"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive("heading", { level: 1 })}
        >
          <span className="text-[11px] font-bold leading-none">H1</span>
        </ToolbarBtn>
        <ToolbarBtn
          title="Título médio"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
        >
          <span className="text-[11px] font-bold leading-none">H2</span>
        </ToolbarBtn>
        <ToolbarBtn
          title="Parágrafo normal"
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph") && !editor.isActive("heading")}
        >
          <span className="text-[11px] font-normal leading-none">¶</span>
        </ToolbarBtn>

        <div className="mx-1.5 h-5 w-px bg-border" />

        <ToolbarBtn
          title="Alinhar à esquerda"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          active={editor.isActive({ textAlign: "left" })}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Centralizar"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          active={editor.isActive({ textAlign: "center" })}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Alinhar à direita"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          active={editor.isActive({ textAlign: "right" })}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarBtn>

        <div className="mx-1.5 h-5 w-px bg-border" />

        <ToolbarBtn
          title="Lista com marcadores"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn
          title="Lista numerada"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarBtn>
        <ToolbarBtn title="Inserir link" onClick={setLink} active={editor.isActive("link")}>
          <LinkIcon className="h-3.5 w-3.5" />
        </ToolbarBtn>
      </div>

      <div
        className="overflow-y-auto bg-white dark:bg-zinc-950"
        style={{ minHeight, maxHeight: minHeight * 2.2 }}
      >
        <EditorContent editor={editor} />
      </div>

      {footer}
    </div>
  );
}
