import { ChevronUp, ChevronDown, ChevronsUp, ChevronsDown } from "lucide-react";
import { type FC, useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type ChatNavigationButtonsProps = {
  containerRef: React.RefObject<HTMLElement | null>;
};

export const ChatNavigationButtons: FC<ChatNavigationButtonsProps> = ({ containerRef }) => {
  const [currentIndex, setCurrentIndex] = useState(-1);

  // Get all user text messages
  const getUserMessages = useCallback(() => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll('[data-user-text-message="true"]'));
  }, [containerRef]);

  // Get the last AI response in the conversation
  const getLastAIResponse = useCallback(() => {
    if (!containerRef.current) return null;
    const responses = containerRef.current.querySelectorAll('[data-final-response="true"]');
    return responses.length > 0 ? responses[responses.length - 1] : null;
  }, [containerRef]);

  const scrollToElement = useCallback((element: Element) => {
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Jump to first user message
  const jumpToFirst = useCallback(() => {
    const userMessages = getUserMessages();
    if (userMessages.length > 0) {
      scrollToElement(userMessages[0]);
      setCurrentIndex(0);
    }
  }, [getUserMessages, scrollToElement]);

  // Jump to last AI response
  const jumpToLast = useCallback(() => {
    const lastResponse = getLastAIResponse();
    if (lastResponse) {
      scrollToElement(lastResponse);
      const userMessages = getUserMessages();
      setCurrentIndex(userMessages.length); // Set beyond user messages
    }
  }, [getLastAIResponse, getUserMessages, scrollToElement]);

  // Previous user message
  const jumpToPrevious = useCallback(() => {
    const userMessages = getUserMessages();
    if (userMessages.length === 0) return;

    // If we're at or beyond the last user message, go to last user message
    if (currentIndex >= userMessages.length) {
      setCurrentIndex(userMessages.length - 1);
      scrollToElement(userMessages[userMessages.length - 1]);
      return;
    }

    // Go to previous, or wrap to last AI response
    if (currentIndex <= 0) {
      // Already at first, stay there
      scrollToElement(userMessages[0]);
      setCurrentIndex(0);
    } else {
      const newIndex = currentIndex - 1;
      scrollToElement(userMessages[newIndex]);
      setCurrentIndex(newIndex);
    }
  }, [getUserMessages, scrollToElement, currentIndex]);

  // Next user message, or last AI response if at end
  const jumpToNext = useCallback(() => {
    const userMessages = getUserMessages();
    if (userMessages.length === 0) return;

    // If not started yet, go to first
    if (currentIndex < 0) {
      scrollToElement(userMessages[0]);
      setCurrentIndex(0);
      return;
    }

    // If at or past last user message, go to last AI response
    if (currentIndex >= userMessages.length - 1) {
      const lastResponse = getLastAIResponse();
      if (lastResponse) {
        scrollToElement(lastResponse);
        setCurrentIndex(userMessages.length);
      }
      return;
    }

    // Go to next user message
    const newIndex = currentIndex + 1;
    scrollToElement(userMessages[newIndex]);
    setCurrentIndex(newIndex);
  }, [getUserMessages, getLastAIResponse, scrollToElement, currentIndex]);

  // Reset index when container changes
  useEffect(() => {
    setCurrentIndex(-1);
  }, [containerRef]);

  const buttonBaseClasses = cn(
    "size-10 rounded-full flex items-center justify-center",
    "bg-muted/80 backdrop-blur-sm border border-border/50",
    "opacity-40 hover:opacity-100 transition-all duration-200",
    "hover:bg-muted hover:border-border hover:shadow-lg",
    "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    "cursor-pointer",
  );

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50">
      <button
        onClick={jumpToFirst}
        className={buttonBaseClasses}
        title="Jump to first user message"
        aria-label="Jump to first user message"
      >
        <ChevronsUp className="size-5 text-foreground" />
      </button>
      <button
        onClick={jumpToPrevious}
        className={buttonBaseClasses}
        title="Previous user message"
        aria-label="Previous user message"
      >
        <ChevronUp className="size-5 text-foreground" />
      </button>
      <button
        onClick={jumpToNext}
        className={buttonBaseClasses}
        title="Next user message"
        aria-label="Next user message"
      >
        <ChevronDown className="size-5 text-foreground" />
      </button>
      <button
        onClick={jumpToLast}
        className={buttonBaseClasses}
        title="Jump to last AI response"
        aria-label="Jump to last AI response"
      >
        <ChevronsDown className="size-5 text-foreground" />
      </button>
    </div>
  );
};
