import { afterEach, describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { isStoredFileReference, normalizeStoredFileUrl, sanitizeStorageKey, storagePublicUrl } from "./storage";

const originalBucket = ENV.awsS3Bucket;
const originalRegion = ENV.awsS3Region;
const originalAwsRegion = ENV.awsRegion;

afterEach(() => {
  ENV.awsS3Bucket = originalBucket;
  ENV.awsS3Region = originalRegion;
  ENV.awsRegion = originalAwsRegion;
});

describe("storagePublicUrl", () => {
  it("returns the authenticated proxy path when S3 is not configured", () => {
    ENV.awsS3Bucket = "";
    expect(storagePublicUrl("broker-docs/contracts/test file.pdf")).toBe(
      "/api/files/content?key=broker-docs%2Fcontracts%2Ftest%20file.pdf"
    );
  });

  it("returns the public proxy path with encoded keys when S3 is configured", () => {
    ENV.awsS3Bucket = "test-bucket";
    ENV.awsS3Region = "us-west-2";
    expect(storagePublicUrl("broker-docs/contracts/test file.pdf")).toBe(
      "/api/files/content?key=broker-docs%2Fcontracts%2Ftest%20file.pdf"
    );
  });
});

describe("normalizeStoredFileUrl", () => {
  it("prefers an explicit file key", () => {
    ENV.awsS3Bucket = "test-bucket";
    expect(
      normalizeStoredFileUrl("https://example.com/ignored", "broker-docs/contracts/lease.pdf")
    ).toBe("/api/files/content?key=broker-docs%2Fcontracts%2Flease.pdf");
  });

  it("normalizes legacy virtual-hosted S3 URLs", () => {
    ENV.awsS3Bucket = "test-bucket";
    ENV.awsS3Region = "us-west-2";
    expect(
      normalizeStoredFileUrl(
        "https://test-bucket.s3.us-west-2.amazonaws.com/broker-docs/contracts/lease.pdf?X-Amz-Signature=abc"
      )
    ).toBe("/api/files/content?key=broker-docs%2Fcontracts%2Flease.pdf");
  });

  it("normalizes legacy path-style S3 URLs", () => {
    ENV.awsS3Bucket = "test-bucket";
    expect(
      normalizeStoredFileUrl(
        "https://s3.amazonaws.com/test-bucket/broker-docs/contracts/lease.pdf?X-Amz-Signature=abc"
      )
    ).toBe("/api/files/content?key=broker-docs%2Fcontracts%2Flease.pdf");
  });

  it("normalizes local URLs and leaves already-normalized URLs unchanged", () => {
    ENV.awsS3Bucket = "";
    expect(normalizeStoredFileUrl("/local-uploads/broker-docs/contracts/lease.pdf")).toBe(
      "/api/files/content?key=broker-docs%2Fcontracts%2Flease.pdf"
    );

    ENV.awsS3Bucket = "test-bucket";
    expect(
      normalizeStoredFileUrl("/api/files/content?key=broker-docs%2Fcontracts%2Flease.pdf")
    ).toBe("/api/files/content?key=broker-docs%2Fcontracts%2Flease.pdf");
  });
});

describe("isStoredFileReference", () => {
  it("recognizes storage keys, local paths, and proxy URLs", () => {
    expect(isStoredFileReference("broker-docs/contracts/lease.pdf")).toBe(true);
    expect(isStoredFileReference("/local-uploads/broker-docs/contracts/lease.pdf")).toBe(true);
    expect(isStoredFileReference("/api/files/content?key=broker-docs%2Fcontracts%2Flease.pdf")).toBe(true);
    expect(
      isStoredFileReference("https://broker.example.com/api/files/content?key=broker-docs%2Fcontracts%2Flease.pdf")
    ).toBe(true);
  });

  it("returns false for non-storage URLs", () => {
    expect(isStoredFileReference("https://example.com/file.pdf")).toBe(false);
    expect(isStoredFileReference("")).toBe(false);
  });
});

describe("sanitizeStorageKey", () => {
  it("normalizes slashes while preserving nested keys", () => {
    expect(sanitizeStorageKey("\\broker-docs\\contracts\\lease.pdf")).toBe("broker-docs/contracts/lease.pdf");
  });

  it("rejects traversal keys", () => {
    expect(() => sanitizeStorageKey("../secrets.txt")).toThrow(/Invalid storage key/i);
    expect(() => sanitizeStorageKey("broker-docs/contracts/../../secrets.txt")).toThrow(/Invalid storage key/i);
  });
});
