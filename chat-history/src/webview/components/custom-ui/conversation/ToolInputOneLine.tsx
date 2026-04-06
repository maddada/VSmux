import type { FC } from "react";

const truncateValue = (value: unknown, maxLength: number = 50): string => {
  if (typeof value === "string") {
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength)}...`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  if (typeof value === "object" && value !== null) {
    return "{...}";
  }
  return String(value);
};

export const ToolInputOneLine: FC<{
  input: Record<string, unknown>;
}> = ({ input }) => {
  const entries = Object.entries(input);

  if (entries.length === 0) {
    return null;
  }

  const displayEntries = entries.slice(0, 3);
  const hasMore = entries.length > 3;

  return (
    <span className="text-muted-foreground">
      {displayEntries.map(([key, value], index) => (
        <span key={key}>
          <span className="text-blue-600 dark:text-blue-400">{key}</span>
          <span>=</span>
          <span className="text-amber-600 dark:text-amber-400">{truncateValue(value)}</span>
          {index < displayEntries.length - 1 && <span>, </span>}
        </span>
      ))}
      {hasMore && <span>, ...</span>}
    </span>
  );
};
