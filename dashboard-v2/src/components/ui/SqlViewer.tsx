import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface SqlViewerProps {
  code: string;
  title?: string;
}

// Minimal override for the editor background to match our theme
const customStyle = {
  ...vscDarkPlus,
  'pre[class*="language-"]': {
    ...vscDarkPlus['pre[class*="language-"]'],
    background: 'transparent',
    margin: 0,
    padding: '1rem',
  }
};

export function SqlViewer({ code, title }: SqlViewerProps) {
  return (
    <div className="border border-border rounded-lg bg-surface-1 overflow-hidden flex flex-col">
      {title && (
        <div className="px-4 py-2 border-b border-border bg-surface-2/50 text-xs font-semibold tracking-wider text-muted uppercase">
          {title}
        </div>
      )}
      <div className="flex-1 overflow-auto custom-scrollbar">
        <SyntaxHighlighter
          language="sql"
          style={customStyle}
          customStyle={{ margin: 0, background: 'transparent' }}
          className="text-sm font-mono"
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
