export type ListingDealDocument = { filename: string; url: string; fileKey: string };

export function fileProxyUrlFromKey(fileKey: string): string {
  return `/api/files/content?key=${encodeURIComponent(fileKey)}`;
}

export function listingSupportingFilesFromDocs(docs: ListingDealDocument[]) {
  return docs
    .filter(doc => doc.url.trim() && doc.fileKey.trim())
    .map(doc => ({
      filename: doc.filename,
      url: doc.url,
      fileKey: doc.fileKey,
      category: "listing_deal_documents",
      label: "Deal Document",
    }));
}
