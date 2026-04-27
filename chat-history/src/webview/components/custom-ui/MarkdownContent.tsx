import { type FC, isValidElement, type ReactNode } from "react";
import Markdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export const MarkdownContent: FC<MarkdownContentProps> = ({ content, className = "" }) => {
  return (
    <div className={`prose prose-neutral dark:prose-invert max-w-none ${className}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1({ children, ...props }) {
            return (
              <h1
                className="text-3xl font-bold mb-6 mt-8 pb-3 border-b border-border text-foreground"
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2({ children, ...props }) {
            return (
              <h2
                className="text-2xl font-semibold mb-4 mt-8 pb-2 border-b border-border/50 text-foreground"
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3({ children, ...props }) {
            return (
              <h3 className="text-xl font-semibold mb-3 mt-6 text-foreground" {...props}>
                {children}
              </h3>
            );
          },
          h4({ children, ...props }) {
            return (
              <h4 className="text-lg font-medium mb-2 mt-4 text-foreground" {...props}>
                {children}
              </h4>
            );
          },
          h5({ children, ...props }) {
            return (
              <h5 className="text-base font-medium mb-2 mt-4 text-foreground" {...props}>
                {children}
              </h5>
            );
          },
          h6({ children, ...props }) {
            return (
              <h6 className="text-sm font-medium mb-2 mt-4 text-muted-foreground" {...props}>
                {children}
              </h6>
            );
          },
          p({ children, ...props }) {
            return (
              <p className="mb-4 leading-7 text-foreground break-all" {...props}>
                {children}
              </p>
            );
          },
          ul({ children, ...props }) {
            return (
              <ul className="mb-4 ml-6 list-disc space-y-2" {...props}>
                {children}
              </ul>
            );
          },
          ol({ children, ...props }) {
            return (
              <ol className="mb-4 ml-6 list-decimal space-y-2" {...props}>
                {children}
              </ol>
            );
          },
          li({ children, ...props }) {
            return (
              <li className="leading-7 text-foreground" {...props}>
                {children}
              </li>
            );
          },
          code({ className, children, ...props }) {
            // This handler is only for inline code now
            // Block code is handled by the pre component
            return (
              <code className="px-1.5 py-0.5 rounded text-sm font-mono text-foreground" {...props}>
                {children}
              </code>
            );
          },
          pre({ children }) {
            // Extract code content from pre children
            // react-markdown wraps code blocks in <pre><code>...</code></pre>
            const extractCodeInfo = (
              node: ReactNode,
            ): { language?: string; content: string } | null => {
              if (!isValidElement(node)) return null;

              const props = node.props as {
                className?: string;
                children?: ReactNode;
              };

              // Check for language class or just extract content if it has children
              const match = /language-(\w+)/.exec(props.className || "");
              const content = props.children;

              if (typeof content === "string" || content != null) {
                return {
                  language: match?.[1],
                  content: String(content).replace(/\n$/, ""),
                };
              }
              return null;
            };

            const codeInfo = extractCodeInfo(children);

            if (codeInfo) {
              const { language, content } = codeInfo;

              // Use SyntaxHighlighter for known languages
              if (language) {
                return (
                  <div className="relative my-6">
                    <div className="flex items-center justify-between bg-muted/30 px-4 py-2 border-b border-border rounded-t-lg">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {language}
                      </span>
                    </div>
                    <SyntaxHighlighter
                      style={oneDark}
                      language={language}
                      PreTag="div"
                      className="!mt-0 !rounded-t-none !rounded-b-lg !border-t-0 !border !border-border"
                      customStyle={{
                        margin: 0,
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                      }}
                    >
                      {content}
                    </SyntaxHighlighter>
                  </div>
                );
              }

              // Use CodeBlock for code without language (with wrap toggle)
              return <CodeBlock>{content}</CodeBlock>;
            }

            // Fallback for other pre content
            return (
              <pre className="overflow-x-auto scroll-mask-x bg-muted/20 p-4 rounded-lg border border-border my-4 text-sm">
                {children}
              </pre>
            );
          },
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-4 border-primary/30 bg-muted/30 pl-6 pr-4 py-4 my-6 italic rounded-r-lg"
                {...props}
              >
                <div className="text-muted-foreground">{children}</div>
              </blockquote>
            );
          },
          a({ children, href, ...props }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:text-primary/80 underline underline-offset-4 decoration-primary/30 hover:decoration-primary/60 transition-colors"
                {...props}
              >
                {children}
              </a>
            );
          },
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto scroll-mask-x my-6 rounded-lg border border-border max-w-full">
                <table className="w-full border-collapse" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          thead({ children, ...props }) {
            return (
              <thead className="bg-muted/50" {...props}>
                {children}
              </thead>
            );
          },
          th({ children, ...props }) {
            return (
              <th
                className="border-b border-border px-4 py-3 text-left font-semibold text-foreground"
                {...props}
              >
                {children}
              </th>
            );
          },
          td({ children, ...props }) {
            return (
              <td className="border-b border-border px-4 py-3 text-foreground" {...props}>
                {children}
              </td>
            );
          },
          hr({ ...props }) {
            return <hr className="my-8 border-t border-border" {...props} />;
          },
          strong({ children, ...props }) {
            return (
              <strong className="font-semibold text-foreground" {...props}>
                {children}
              </strong>
            );
          },
          em({ children, ...props }) {
            return (
              <em className="italic text-foreground" {...props}>
                {children}
              </em>
            );
          },
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};
