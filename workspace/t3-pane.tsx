import { useEffect, useRef } from "react";
import type { WorkspacePanelT3Pane } from "../shared/workspace-panel-contract";

export type T3PaneProps = {
  isFocused: boolean;
  onFocus: () => void;
  pane: WorkspacePanelT3Pane;
};

export const T3Pane: React.FC<T3PaneProps> = ({ isFocused, onFocus, pane }) => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const blobUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const blob = new Blob([pane.html], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    blobUrlRef.current = blobUrl;

    if (iframeRef.current) {
      iframeRef.current.src = blobUrl;
    }

    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = undefined;
      }
    };
  }, [pane.html]);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    iframeRef.current?.contentWindow?.postMessage({ type: "focusComposer" }, "*");
  }, [isFocused, pane.sessionId]);

  return (
    <div className="t3-pane-root" onMouseDown={onFocus}>
      <iframe
        className="t3-pane-frame"
        onLoad={() => {
          if (!isFocused) {
            return;
          }
          iframeRef.current?.contentWindow?.postMessage({ type: "focusComposer" }, "*");
        }}
        ref={iframeRef}
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads"
        title={pane.sessionRecord.title}
      />
    </div>
  );
};
