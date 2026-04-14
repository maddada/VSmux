import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

type CollapsibleStyle = CSSProperties & {
  "--sidebar-collapse-content-height"?: string;
};

export function useCollapsibleHeight<T extends HTMLElement>() {
  const contentRef = useRef<T>(null);
  const [contentHeight, setContentHeight] = useState<number>();

  useLayoutEffect(() => {
    const element = contentRef.current;
    if (!element) {
      return;
    }

    let animationFrameId = 0;

    const updateHeight = () => {
      setContentHeight(element.scrollHeight);
    };

    const scheduleUpdate = () => {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = window.requestAnimationFrame(updateHeight);
    };

    updateHeight();
    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const collapsibleStyle =
    contentHeight === undefined
      ? undefined
      : ({
          "--sidebar-collapse-content-height": `${contentHeight}px`,
        } satisfies CollapsibleStyle);

  return {
    collapsibleStyle,
    contentRef,
  };
}
