import {
  IconChevronDown,
  IconExternalLink,
  IconGitCommit,
  IconGitPullRequest,
  IconLoader2,
  IconUpload,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildSidebarGitMenuItems,
  resolveSidebarGitPrimaryActionState,
  type SidebarGitAction,
  type SidebarGitState,
} from "../shared/sidebar-git";
import type { WebviewApi } from "./webview-api";

export type GitActionRowProps = {
  git: SidebarGitState;
  vscode: WebviewApi;
};

export function GitActionRow({ git, vscode }: GitActionRowProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuItems = useMemo(() => buildSidebarGitMenuItems(git), [git]);
  const primaryAction = useMemo(() => resolveSidebarGitPrimaryActionState(git), [git]);
  const primaryDescription = primaryAction.disabledReason ?? primaryAction.label;

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) {
        return;
      }

      setIsMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  const requestRefresh = () => {
    vscode.postMessage({ type: "refreshGitState" });
  };

  const runAction = (action: SidebarGitAction) => {
    setIsMenuOpen(false);
    vscode.postMessage({
      action,
      type: "runSidebarGitAction",
    });
  };

  return (
    <div className="git-action-row" onMouseEnter={requestRefresh} ref={wrapperRef}>
      <div className="git-action-split-button">
        <button
          aria-label={primaryDescription}
          className="git-action-main-button"
          data-empty-space-blocking="true"
          disabled={primaryAction.disabled}
          onClick={() => runAction(primaryAction.action)}
          title={primaryDescription}
          type="button"
        >
          <span aria-hidden="true" className="git-action-main-icon-shell">
            {git.isBusy ? (
              <IconLoader2
                className="git-action-main-icon git-action-main-icon-spinning"
                size={16}
              />
            ) : (
              <GitActionIcon action={primaryAction.action} />
            )}
          </span>
          <span className="git-action-main-label">{primaryAction.label}</span>
          <span aria-hidden="true" className="git-action-diff-stat">
            <span className="git-action-diff-stat-additions">+{git.additions}</span>
            <span className="git-action-diff-stat-divider">/</span>
            <span className="git-action-diff-stat-deletions">-{git.deletions}</span>
          </span>
        </button>
        <button
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label="Git action options"
          className="git-action-toggle-button"
          data-empty-space-blocking="true"
          onClick={() => {
            if (!isMenuOpen) {
              requestRefresh();
            }
            setIsMenuOpen((previous) => !previous);
          }}
          title="Git action options"
          type="button"
        >
          <IconChevronDown aria-hidden="true" className="git-action-toggle-icon" size={16} />
        </button>
      </div>
      {isMenuOpen ? (
        <div className="git-action-menu" role="menu">
          {menuItems.map((item) => (
            <button
              aria-label={item.disabledReason ?? item.label}
              className="git-action-menu-item"
              disabled={item.disabled}
              key={item.action}
              onClick={() => runAction(item.action)}
              role="menuitem"
              title={item.disabledReason ?? item.label}
              type="button"
            >
              <GitActionIcon action={item.action} />
              <span className="git-action-menu-item-label">{item.label}</span>
              {item.action === "pr" && git.pr?.state === "open" ? (
                <IconExternalLink
                  aria-hidden="true"
                  className="git-action-menu-item-trailing-icon"
                  size={14}
                />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type GitActionIconProps = {
  action: SidebarGitAction;
};

function GitActionIcon({ action }: GitActionIconProps) {
  if (action === "push") {
    return <IconUpload aria-hidden="true" className="git-action-main-icon" size={16} />;
  }

  if (action === "pr") {
    return <IconGitPullRequest aria-hidden="true" className="git-action-main-icon" size={16} />;
  }

  return <IconGitCommit aria-hidden="true" className="git-action-main-icon" size={16} />;
}
