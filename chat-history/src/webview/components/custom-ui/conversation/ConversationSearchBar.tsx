import type { KeyboardEventHandler, RefObject } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ConversationSearchBarProps = {
  inputRef: RefObject<HTMLInputElement | null>;
  isOpen: boolean;
  query: string;
  status?: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onKeyDown: KeyboardEventHandler<HTMLInputElement>;
};

export function ConversationSearchBar({
  inputRef,
  isOpen,
  query,
  status,
  onChange,
  onClose,
  onNext,
  onPrevious,
  onKeyDown,
}: ConversationSearchBarProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="shrink-0 border-b bg-background/95 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Find in conversation"
            className="pl-9"
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
        <Button variant="outline" size="sm" onClick={onPrevious} disabled={!query.trim()}>
          <ChevronUp className="mr-2 size-4" />
          Prev
        </Button>
        <Button variant="outline" size="sm" onClick={onNext} disabled={!query.trim()}>
          <ChevronDown className="mr-2 size-4" />
          Next
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="mr-2 size-4" />
          Close
        </Button>
      </div>
      <div className="mx-auto mt-2 flex max-w-4xl items-center justify-between text-xs text-muted-foreground">
        <span>{status ?? "Press Enter for next result, Shift+Enter for previous."}</span>
        <span>Cmd/Ctrl+F</span>
      </div>
    </div>
  );
}
