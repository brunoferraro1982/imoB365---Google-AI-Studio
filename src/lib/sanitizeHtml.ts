import DOMPurify from "isomorphic-dompurify";

// Allowlist alinhado 1:1 com o que o RichTextEditor (Tiptap StarterKit +
// TextAlign + Underline + Link) consegue de fato produzir — ver
// src/components/ui/rich-text-editor.tsx. Qualquer coisa fora disso (script,
// on*, iframe, etc.) é removida, mesmo que tenha sido gravada direto via API
// pulando a UI do editor.
const ALLOWED_TAGS = [
  "p",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "strong",
  "em",
  "u",
  "br",
  "blockquote",
  "code",
  "pre",
  "hr",
];

const ALLOWED_ATTR = ["href", "style", "target", "rel"];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
