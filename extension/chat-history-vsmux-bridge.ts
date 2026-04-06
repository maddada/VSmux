export type ChatHistoryResumeSource = "Claude" | "Codex";

export type ChatHistoryResumeRequest = {
  cwd?: string;
  sessionId: string;
  source: ChatHistoryResumeSource;
};

export type ChatHistoryVSmuxTarget = {
  resumeChatHistorySession(input: ChatHistoryResumeRequest): Promise<void>;
};

let chatHistoryVSmuxTarget: ChatHistoryVSmuxTarget | undefined;

export function setChatHistoryVSmuxTarget(target: ChatHistoryVSmuxTarget | undefined): void {
  chatHistoryVSmuxTarget = target;
}

export function getChatHistoryVSmuxTarget(): ChatHistoryVSmuxTarget | undefined {
  return chatHistoryVSmuxTarget;
}
