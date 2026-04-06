const USERNAME_KEY = "macos-username";

export function getStoredUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function setStoredUsername(username: string): void {
  localStorage.setItem(USERNAME_KEY, username);
}

export function getOrPromptUsername(): string | null {
  let username = getStoredUsername();
  if (!username) {
    username = window.prompt("Enter your macOS username (for clipboard path):");
    if (username) {
      setStoredUsername(username);
    }
  }
  return username;
}
