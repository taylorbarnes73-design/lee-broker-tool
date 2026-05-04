import type { Response } from "express";

export type AdminErrorBody = {
  error: {
    code: string;
    message: string;
    field?: string;
  };
};

export function sendAdminError(
  res: Response,
  status: number,
  code: string,
  message: string,
  field?: string
): void {
  const body: AdminErrorBody = { error: { code, message } };
  if (field !== undefined) body.error.field = field;
  res.status(status).json(body);
}

export class AdminUserError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;

  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function sendAdminUserError(res: Response, err: AdminUserError): void {
  sendAdminError(res, err.status, err.code, err.message, err.field);
}
