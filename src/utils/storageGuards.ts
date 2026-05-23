export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

export function isFileSystemAccessAvailable(): boolean {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
}
