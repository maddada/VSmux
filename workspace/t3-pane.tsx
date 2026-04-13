import { useEffect, useEffectEvent, useRef } from "react";
import type {
  WorkspacePanelAutoFocusRequest,
  WorkspacePanelT3Pane,
} from "../shared/workspace-panel-contract";
import {
  acquireCachedT3Runtime,
  attachCachedT3Runtime,
  releaseCachedT3Runtime,
  type CachedT3Runtime,
} from "./t3-runtime-cache";

type T3ClipboardFilePayload = {
  buffer: ArrayBuffer;
  name: string;
  type: string;
};

export type T3PaneProps = {
  autoFocusRequest?: WorkspacePanelAutoFocusRequest;
  debugLog?: (event: string, payload?: Record<string, unknown>) => void;
  focusSuppressedUntil: number;
  isFocused: boolean;
  onFocus: () => void;
  onThreadChanged: (payload: { sessionId: string; threadId: string; title?: string }) => void;
  pane: WorkspacePanelT3Pane;
};

export const T3Pane: React.FC<T3PaneProps> = ({
  autoFocusRequest,
  debugLog,
  focusSuppressedUntil,
  isFocused,
  onFocus,
  onThreadChanged,
  pane,
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const runtimeRef = useRef<CachedT3Runtime | null>(null);
  const pendingExplicitComposerFocusRef = useRef(false);
  const pendingComposerFocusTimerRef = useRef<number | undefined>(undefined);
  const handledAutoFocusRequestIdRef = useRef<number | undefined>(undefined);
  const previousIsFocusedRef = useRef(isFocused);
  const isComposerFocusSuppressed = () => focusSuppressedUntil > performance.now();
  const reportDebug = useEffectEvent((event: string, payload?: Record<string, unknown>) => {
    debugLog?.(event, payload);
  });
  const emitThreadChanged = useEffectEvent(
    (payload: { sessionId: string; threadId: string; title?: string }) => {
      onThreadChanged(payload);
    },
  );

  const requestComposerFocus = (reason: string) => {
    reportDebug("workspace.t3PaneComposerFocusRequested", {
      reason,
      sessionId: pane.sessionId,
      threadId: pane.sessionRecord.t3.threadId,
      ...readFrameWindowState(iframeRef.current?.contentWindow),
    });
    iframeRef.current?.contentWindow?.postMessage({ type: "focusComposer" }, "*");
  };

  const blurIframeOnly = (reason: string) => {
    reportDebug("workspace.t3PaneComposerFocusReleased", {
      mode: "iframeOnly",
      reason,
      sessionId: pane.sessionId,
      threadId: pane.sessionRecord.t3.threadId,
      ...readFrameWindowState(iframeRef.current?.contentWindow),
    });
    iframeRef.current?.blur();
  };

  const releaseComposerFocus = (reason: string) => {
    reportDebug("workspace.t3PaneComposerFocusReleased", {
      mode: "composer",
      reason,
      sessionId: pane.sessionId,
      threadId: pane.sessionRecord.t3.threadId,
      ...readFrameWindowState(iframeRef.current?.contentWindow),
    });
    iframeRef.current?.contentWindow?.postMessage({ type: "blurComposer" }, "*");
    iframeRef.current?.blur();
  };

  useEffect(() => {
    const cacheKey = pane.sessionId;
    const runtime = acquireCachedT3Runtime({
      cacheKey,
      html: pane.html,
      renderNonce: pane.renderNonce,
      reportDebug,
      sessionId: pane.sessionId,
      threadId: pane.sessionRecord.t3.threadId,
      title: pane.sessionRecord.title,
    });
    runtimeRef.current = runtime;
    iframeRef.current = runtime.iframe;
    attachCachedT3Runtime(runtime, hostRef.current, reportDebug);

    reportDebug("workspace.t3PaneIframeAttached", {
      iframeSrc: runtime.iframeSrc,
      renderNonce: pane.renderNonce,
      runtimeId: runtime.runtimeId,
      sessionId: pane.sessionId,
      threadId: pane.sessionRecord.t3.threadId,
    });

    return () => {
      releaseComposerFocus("unmount");
      iframeRef.current = null;
      runtimeRef.current = null;
      releaseCachedT3Runtime(cacheKey, reportDebug);
    };
  }, [pane.html, pane.renderNonce, pane.sessionId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    runtime.title = pane.sessionRecord.title;
    runtime.iframe.title = pane.sessionRecord.title;
  }, [pane.sessionRecord.title]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }

    attachCachedT3Runtime(runtime, hostRef.current, reportDebug);
  });

  useEffect(() => {
    const host = hostRef.current;
    const iframe = iframeRef.current;
    if (!host || !iframe) {
      return;
    }

    reportDebug("workspace.t3PaneRenderState", {
      hostChildCount: host.childElementCount,
      iframeConnected: iframe.isConnected,
      iframeDisplay: iframe.style.display || "default",
      iframeParentTag: iframe.parentElement?.tagName ?? null,
      isFocused,
      isVisible: pane.isVisible,
      sessionId: pane.sessionId,
      threadId: pane.sessionRecord.t3.threadId,
    });
  }, [isFocused, pane.isVisible, pane.sessionId, pane.sessionRecord.t3.threadId]);

  useEffect(() => {
    const host = hostRef.current;
    const iframe = iframeRef.current;
    if (!host || !iframe) {
      return;
    }

    const hostObserver = new MutationObserver(() => {
      reportDebug("workspace.t3PaneHostMutated", {
        hostChildCount: host.childElementCount,
        iframeConnected: iframe.isConnected,
        iframeParentTag: iframe.parentElement?.tagName ?? null,
        isFocused,
        isVisible: pane.isVisible,
        sessionId: pane.sessionId,
      });
    });
    hostObserver.observe(host, { childList: true });

    const iframeObserver = new MutationObserver(() => {
      reportDebug("workspace.t3PaneIframeAttributesChanged", {
        ariaHidden: iframe.getAttribute("aria-hidden"),
        display: iframe.style.display || "default",
        inert: iframe.hasAttribute("inert"),
        isFocused,
        isVisible: pane.isVisible,
        pointerEvents: iframe.style.pointerEvents || "default",
        sessionId: pane.sessionId,
        tabIndex: iframe.tabIndex,
      });
    });
    iframeObserver.observe(iframe, {
      attributeFilter: ["aria-hidden", "inert", "style", "tabindex"],
      attributes: true,
    });

    return () => {
      hostObserver.disconnect();
      iframeObserver.disconnect();
    };
  }, [isFocused, pane.isVisible, pane.sessionId]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    const handleLoad = () => {
      reportDebug("workspace.t3PaneIframeMounted", {
        iframeSrc: iframe.src,
        ...readFrameWindowState(iframe.contentWindow),
        isFocused,
        renderNonce: pane.renderNonce,
        sessionId: pane.sessionId,
        threadId: pane.sessionRecord.t3.threadId,
      });
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [isFocused, pane.renderNonce, pane.sessionId, pane.sessionRecord.t3.threadId]);

  useEffect(() => {
    return () => {
      if (pendingComposerFocusTimerRef.current !== undefined) {
        window.clearTimeout(pendingComposerFocusTimerRef.current);
        pendingComposerFocusTimerRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    const wasFocused = previousIsFocusedRef.current;
    previousIsFocusedRef.current = isFocused;

    if (pendingComposerFocusTimerRef.current !== undefined) {
      window.clearTimeout(pendingComposerFocusTimerRef.current);
      pendingComposerFocusTimerRef.current = undefined;
    }

    if (isFocused && pendingExplicitComposerFocusRef.current) {
      const suppressionRemainingMs = Math.max(0, focusSuppressedUntil - performance.now());
      if (suppressionRemainingMs <= 0) {
        pendingExplicitComposerFocusRef.current = false;
        reportDebug("workspace.t3PaneFocusSync", {
          action: "focusComposerExplicit",
          focusSuppressed: false,
          isVisible: pane.isVisible,
          sessionId: pane.sessionId,
        });
        requestComposerFocus("explicitActivation");
        return;
      }

      reportDebug("workspace.t3PaneFocusSync", {
        action: "focusComposerDeferred",
        focusSuppressed: true,
        isVisible: pane.isVisible,
        sessionId: pane.sessionId,
        suppressionRemainingMs: Math.round(suppressionRemainingMs),
      });
      pendingComposerFocusTimerRef.current = window.setTimeout(() => {
        pendingComposerFocusTimerRef.current = undefined;
        if (!pendingExplicitComposerFocusRef.current) {
          return;
        }
        pendingExplicitComposerFocusRef.current = false;
        requestComposerFocus("explicitActivationAfterGuard");
      }, suppressionRemainingMs + 10);
      return;
    }

    const focusSuppressed = focusSuppressedUntil > performance.now();
    if ((focusSuppressed || !pane.isVisible) && wasFocused) {
      reportDebug("workspace.t3PaneFocusSync", {
        action: "blurComposer",
        focusSuppressed,
        isVisible: pane.isVisible,
        sessionId: pane.sessionId,
      });
      if (focusSuppressed && pane.isVisible) {
        blurIframeOnly("focusSuppressed");
      } else {
        releaseComposerFocus("notVisible");
      }
    }
  }, [focusSuppressedUntil, isFocused, pane.isVisible, pane.sessionId]);

  useEffect(() => {
    if (!autoFocusRequest || autoFocusRequest.sessionId !== pane.sessionId) {
      return;
    }

    if (handledAutoFocusRequestIdRef.current === autoFocusRequest.requestId) {
      return;
    }
    handledAutoFocusRequestIdRef.current = autoFocusRequest.requestId;

    if (autoFocusRequest.source !== "sidebar") {
      return;
    }

    pendingExplicitComposerFocusRef.current = true;
    reportDebug("workspace.t3PaneAutoFocusRequestReceived", {
      isFocused,
      requestId: autoFocusRequest.requestId,
      sessionId: pane.sessionId,
      source: autoFocusRequest.source,
      threadId: pane.sessionRecord.t3.threadId,
    });

    if (isFocused && !isComposerFocusSuppressed()) {
      pendingExplicitComposerFocusRef.current = false;
      requestComposerFocus("sidebarActivation");
    }
  }, [autoFocusRequest, isFocused, pane.sessionId, pane.sessionRecord.t3.threadId]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) {
      return;
    }

    const focusSuppressed = isComposerFocusSuppressed();
    const shouldBeInteractive = pane.isVisible && isFocused && !focusSuppressed;
    iframe.tabIndex = shouldBeInteractive ? 0 : -1;
    iframe.setAttribute("aria-hidden", pane.isVisible ? "false" : "true");
    iframe.style.display = pane.isVisible ? "" : "none";
    iframe.style.pointerEvents = pane.isVisible ? "auto" : "none";
    if (pane.isVisible) {
      iframe.removeAttribute("inert");
      hostRef.current?.removeAttribute("inert");
    } else {
      iframe.setAttribute("inert", "");
      hostRef.current?.setAttribute("inert", "");
    }
    reportDebug("workspace.t3PaneIframeInteractivity", {
      ariaHidden: pane.isVisible ? "false" : "true",
      display: iframe.style.display || "default",
      focusSuppressed,
      inert: !pane.isVisible,
      isFocused,
      isVisible: pane.isVisible,
      pointerEvents: iframe.style.pointerEvents,
      sessionId: pane.sessionId,
      tabIndex: iframe.tabIndex,
    });

    if (!pane.isVisible || focusSuppressed) {
      if (!pane.isVisible) {
        releaseComposerFocus("notVisible");
      } else {
        blurIframeOnly("focusSuppressed");
      }
    }
  }, [focusSuppressedUntil, isFocused, pane.isVisible, pane.sessionId]);

  useEffect(() => {
    const readClipboardPayload = async (): Promise<{
      files: T3ClipboardFilePayload[];
      text: string;
    }> => {
      let text = "";
      const files: T3ClipboardFilePayload[] = [];

      if (typeof navigator.clipboard.read === "function") {
        const clipboardItems = await navigator.clipboard.read().catch(() => []);
        let imageIndex = 0;
        for (const item of clipboardItems) {
          for (const mimeType of item.types) {
            const blob = await item.getType(mimeType).catch(() => undefined);
            if (!blob) {
              continue;
            }

            if (!text && mimeType === "text/plain") {
              text = await blob.text().catch(() => "");
              continue;
            }

            if (!mimeType.startsWith("image/")) {
              continue;
            }

            imageIndex += 1;
            files.push({
              buffer: await blob.arrayBuffer(),
              name: inferClipboardImageName(mimeType, imageIndex),
              type: mimeType,
            });
          }
        }
      }

      if (!text) {
        text = await navigator.clipboard.readText().catch(() => "");
      }

      return { files, text };
    };

    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data?.type !== "string") {
        return;
      }

      if (event.data.type === "vsmuxT3ThreadChanged") {
        const sessionId =
          typeof event.data.sessionId === "string" ? event.data.sessionId.trim() : "";
        const threadId = typeof event.data.threadId === "string" ? event.data.threadId.trim() : "";
        const title =
          typeof event.data.title === "string" && event.data.title.trim().length > 0
            ? event.data.title.trim()
            : undefined;
        if (!sessionId || !threadId || sessionId !== pane.sessionId) {
          return;
        }

        reportDebug("workspace.t3PaneThreadChangedReceived", {
          sessionId,
          threadId,
          title,
        });
        emitThreadChanged({ sessionId, threadId, title });
        return;
      }

      if (event.data.type === "vsmuxT3DebugLog") {
        const sessionId =
          typeof event.data.sessionId === "string" ? event.data.sessionId.trim() : "";
        const logEvent =
          typeof event.data.event === "string" && event.data.event.trim().length > 0
            ? event.data.event.trim()
            : "";
        if (!sessionId || sessionId !== pane.sessionId || !logEvent) {
          return;
        }

        reportDebug(logEvent, {
          ...(isRecord(event.data.payload) ? event.data.payload : {}),
          sessionId,
        });
        return;
      }

      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (event.data.type === "vsmuxT3ClipboardWrite") {
        const text = typeof event.data.text === "string" ? event.data.text : "";
        void navigator.clipboard.writeText(text).catch(() => {});
        return;
      }

      if (event.data.type === "vsmuxT3ClipboardWriteRequest") {
        const requestId =
          typeof event.data.requestId === "number" ? event.data.requestId : undefined;
        const text = typeof event.data.text === "string" ? event.data.text : "";
        if (requestId === undefined) {
          return;
        }

        void navigator.clipboard.writeText(text).then(
          () => {
            iframeRef.current?.contentWindow?.postMessage(
              {
                ok: true,
                requestId,
                type: "vsmuxT3ClipboardWriteResult",
              },
              "*",
            );
          },
          (error) => {
            iframeRef.current?.contentWindow?.postMessage(
              {
                error: error instanceof Error ? error.message : String(error),
                ok: false,
                requestId,
                type: "vsmuxT3ClipboardWriteResult",
              },
              "*",
            );
          },
        );
        return;
      }

      if (event.data.type === "vsmuxT3ClipboardReadRequest") {
        const requestId =
          typeof event.data.requestId === "number" ? event.data.requestId : undefined;
        if (requestId === undefined) {
          return;
        }

        void readClipboardPayload().then(({ files, text }) => {
          const transferables = files.map((file) => file.buffer);
          iframeRef.current?.contentWindow?.postMessage(
            {
              files,
              requestId,
              text,
              type: "vsmuxT3ClipboardReadResult",
            },
            "*",
            transferables,
          );
        });
        return;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [pane.sessionId]);

  const handleMouseDown = () => {
    reportDebug("workspace.t3PaneMouseDown", {
      isFocused,
      isVisible: pane.isVisible,
      sessionId: pane.sessionId,
      threadId: pane.sessionRecord.t3.threadId,
    });
    if (!isFocused) {
      pendingExplicitComposerFocusRef.current = true;
      onFocus();
      return;
    }

    onFocus();
  };

  return (
    <div className="t3-pane-root" onMouseDown={handleMouseDown}>
      <div className="t3-pane-host" ref={hostRef} />
    </div>
  );
};

function inferClipboardImageName(mimeType: string, index: number): string {
  const extension = mimeType.split("/")[1] ?? "png";
  return `clipboard-image-${index}.${extension}`;
}

function readFrameWindowState(frameWindow: Window | null | undefined): Record<string, unknown> {
  if (!frameWindow) {
    return { frameWindowAvailable: false };
  }

  try {
    return {
      activeThreadId:
        (frameWindow as Window & { __VSMUX_T3_ACTIVE_THREAD_ID__?: string })
          .__VSMUX_T3_ACTIVE_THREAD_ID__ ?? undefined,
      frameWindowAvailable: true,
      hash: frameWindow.location.hash,
      href: frameWindow.location.href,
      pathname: frameWindow.location.pathname,
      readyState: frameWindow.document.readyState,
      title: frameWindow.document.title,
    };
  } catch (error) {
    return {
      frameWindowAvailable: true,
      frameWindowStateError: error instanceof Error ? error.message : String(error),
    };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}
