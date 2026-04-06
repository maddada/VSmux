export function formatFileSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
}

export function cleanFolderName(folder: string): string {
  return folder
    .replace(/-?Users-madda-dev-/g, "")
    .replace(/-?Users-madda-/g, "")
    .replace(/^-+/, "");
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${year}-${month}-${day} ${hour12}:${minutes} ${ampm}`;
}
