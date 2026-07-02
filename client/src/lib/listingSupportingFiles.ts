export function isListingSupportingFileUrl(url: string): boolean {
  return (
    /^https?:\/\//i.test(url) ||
    url.startsWith("/api/files/content?key=") ||
    url.startsWith("/local-uploads/")
  );
}
