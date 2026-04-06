import { Download, Copy, Check } from "lucide-react";
import { type FC, useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Conversation, ErrorJsonl } from "@/lib/conversation-schema";
import {
  type ExportOptions,
  defaultExportOptions,
  exportConversation,
  copyToClipboard,
  saveToFile,
  getExportFileName,
} from "@/lib/export-utils";

interface ExportDialogProps {
  conversations: (Conversation | ErrorJsonl)[];
  fileName: string;
  children: React.ReactNode;
}

export const ExportDialog: FC<ExportDialogProps> = ({ conversations, fileName, children }) => {
  const [options, setOptions] = useState<ExportOptions>(defaultExportOptions);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const updateOption = useCallback(
    <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
      setOptions((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const updateToolOption = useCallback((key: keyof ExportOptions["tools"], value: boolean) => {
    setOptions((prev) => ({
      ...prev,
      tools: { ...prev.tools, [key]: value },
    }));
  }, []);

  // Check if all tools are selected
  const allToolsSelected = useMemo(() => {
    return Object.values(options.tools).every(Boolean);
  }, [options.tools]);

  // Check if some tools are selected
  const someToolsSelected = useMemo(() => {
    const values = Object.values(options.tools);
    return values.some(Boolean) && !values.every(Boolean);
  }, [options.tools]);

  const toggleAllTools = useCallback(() => {
    const newValue = !allToolsSelected;
    setOptions((prev) => ({
      ...prev,
      tools: Object.fromEntries(
        Object.keys(prev.tools).map((key) => [key, newValue]),
      ) as ExportOptions["tools"],
    }));
  }, [allToolsSelected]);

  const handleCopyToClipboard = useCallback(async () => {
    const content = exportConversation(conversations, options, fileName);
    const success = await copyToClipboard(content);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [conversations, options, fileName]);

  const handleSaveToFile = useCallback(() => {
    const content = exportConversation(conversations, options, fileName);
    const exportFileName = getExportFileName(fileName);
    saveToFile(content, exportFileName);
    setOpen(false);
  }, [conversations, options, fileName]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={children as React.ReactElement} />
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Conversation</DialogTitle>
          <DialogDescription>
            Select what you want to include in the export. The exported markdown includes tags for
            re-importing later.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Message Types Section */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium leading-none">Message Types</h4>
            <div className="grid grid-cols-2 gap-3">
              <CheckboxItem
                id="userMessages"
                label="User Messages"
                checked={options.userMessages}
                onCheckedChange={(checked) => updateOption("userMessages", checked === true)}
              />
              <CheckboxItem
                id="assistantMessages"
                label="Assistant Messages"
                checked={options.assistantMessages}
                onCheckedChange={(checked) => updateOption("assistantMessages", checked === true)}
              />
              <CheckboxItem
                id="thinkingContent"
                label="Thinking Content"
                checked={options.thinkingContent}
                onCheckedChange={(checked) => updateOption("thinkingContent", checked === true)}
              />
              <CheckboxItem
                id="systemMessages"
                label="System Messages"
                checked={options.systemMessages}
                onCheckedChange={(checked) => updateOption("systemMessages", checked === true)}
              />
              <CheckboxItem
                id="summaryMessages"
                label="Summary Messages"
                checked={options.summaryMessages}
                onCheckedChange={(checked) => updateOption("summaryMessages", checked === true)}
              />
              <CheckboxItem
                id="fileHistorySnapshots"
                label="File History Snapshots"
                checked={options.fileHistorySnapshots}
                onCheckedChange={(checked) =>
                  updateOption("fileHistorySnapshots", checked === true)
                }
              />
              <CheckboxItem
                id="queueOperations"
                label="Queue Operations"
                checked={options.queueOperations}
                onCheckedChange={(checked) => updateOption("queueOperations", checked === true)}
              />
            </div>
          </div>

          <Separator />

          {/* Tool Content Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Checkbox
                id="toolContent"
                checked={options.toolContent}
                onCheckedChange={(checked) => updateOption("toolContent", checked === true)}
              />
              <Label htmlFor="toolContent" className="text-sm font-medium leading-none">
                Tool Results
              </Label>
            </div>

            {options.toolContent && (
              <div className="pl-6 space-y-4">
                {/* Select All Tools */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="allTools"
                    checked={allToolsSelected}
                    indeterminate={someToolsSelected}
                    onCheckedChange={toggleAllTools}
                  />
                  <Label htmlFor="allTools" className="text-sm font-medium text-muted-foreground">
                    Select All Tools
                  </Label>
                </div>

                {/* Core Tools */}
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Core Tools
                  </h5>
                  <div className="grid grid-cols-3 gap-2">
                    <CheckboxItem
                      id="tool-Bash"
                      label="Bash"
                      checked={options.tools.Bash}
                      onCheckedChange={(checked) => updateToolOption("Bash", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-Read"
                      label="Read"
                      checked={options.tools.Read}
                      onCheckedChange={(checked) => updateToolOption("Read", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-Write"
                      label="Write"
                      checked={options.tools.Write}
                      onCheckedChange={(checked) => updateToolOption("Write", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-Edit"
                      label="Edit"
                      checked={options.tools.Edit}
                      onCheckedChange={(checked) => updateToolOption("Edit", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-Glob"
                      label="Glob"
                      checked={options.tools.Glob}
                      onCheckedChange={(checked) => updateToolOption("Glob", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-Grep"
                      label="Grep"
                      checked={options.tools.Grep}
                      onCheckedChange={(checked) => updateToolOption("Grep", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-WebFetch"
                      label="WebFetch"
                      checked={options.tools.WebFetch}
                      onCheckedChange={(checked) => updateToolOption("WebFetch", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-Task"
                      label="Task"
                      checked={options.tools.Task}
                      onCheckedChange={(checked) => updateToolOption("Task", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-TodoWrite"
                      label="TodoWrite"
                      checked={options.tools.TodoWrite}
                      onCheckedChange={(checked) => updateToolOption("TodoWrite", checked === true)}
                    />
                  </div>
                </div>

                {/* MCP Browser Tools */}
                <div className="space-y-2">
                  <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Browser Tools (MCP)
                  </h5>
                  <div className="grid grid-cols-2 gap-2">
                    <CheckboxItem
                      id="tool-mcp_computer"
                      label="Computer (screenshots)"
                      checked={options.tools.mcp_computer}
                      onCheckedChange={(checked) =>
                        updateToolOption("mcp_computer", checked === true)
                      }
                    />
                    <CheckboxItem
                      id="tool-mcp_javascript"
                      label="JavaScript"
                      checked={options.tools.mcp_javascript}
                      onCheckedChange={(checked) =>
                        updateToolOption("mcp_javascript", checked === true)
                      }
                    />
                    <CheckboxItem
                      id="tool-mcp_navigate"
                      label="Navigate"
                      checked={options.tools.mcp_navigate}
                      onCheckedChange={(checked) =>
                        updateToolOption("mcp_navigate", checked === true)
                      }
                    />
                    <CheckboxItem
                      id="tool-mcp_read_page"
                      label="Read Page"
                      checked={options.tools.mcp_read_page}
                      onCheckedChange={(checked) =>
                        updateToolOption("mcp_read_page", checked === true)
                      }
                    />
                    <CheckboxItem
                      id="tool-mcp_find"
                      label="Find"
                      checked={options.tools.mcp_find}
                      onCheckedChange={(checked) => updateToolOption("mcp_find", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-mcp_form_input"
                      label="Form Input"
                      checked={options.tools.mcp_form_input}
                      onCheckedChange={(checked) =>
                        updateToolOption("mcp_form_input", checked === true)
                      }
                    />
                    <CheckboxItem
                      id="tool-mcp_network"
                      label="Network Requests"
                      checked={options.tools.mcp_network}
                      onCheckedChange={(checked) =>
                        updateToolOption("mcp_network", checked === true)
                      }
                    />
                    <CheckboxItem
                      id="tool-mcp_console"
                      label="Console Messages"
                      checked={options.tools.mcp_console}
                      onCheckedChange={(checked) =>
                        updateToolOption("mcp_console", checked === true)
                      }
                    />
                    <CheckboxItem
                      id="tool-mcp_tabs"
                      label="Tabs"
                      checked={options.tools.mcp_tabs}
                      onCheckedChange={(checked) => updateToolOption("mcp_tabs", checked === true)}
                    />
                    <CheckboxItem
                      id="tool-mcp_other"
                      label="Other MCP Tools"
                      checked={options.tools.mcp_other}
                      onCheckedChange={(checked) => updateToolOption("mcp_other", checked === true)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleCopyToClipboard}>
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-2" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy to Clipboard
              </>
            )}
          </Button>
          <Button onClick={handleSaveToFile}>
            <Download className="h-4 w-4 mr-2" />
            Save to File
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Reusable checkbox item component
interface CheckboxItemProps {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean | "indeterminate") => void;
}

const CheckboxItem: FC<CheckboxItemProps> = ({ id, label, checked, onCheckedChange }) => {
  return (
    <div className="flex items-center gap-2">
      <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="text-sm cursor-pointer">
        {label}
      </Label>
    </div>
  );
};
