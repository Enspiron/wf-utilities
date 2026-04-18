import { NextResponse } from 'next/server';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function jsonOk<T>(payload: T, status = 200) {
  return NextResponse.json({ ok: true, ...payload }, { status });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return (await request.json()) as unknown;
  } catch {
    throw new Error('Invalid JSON body.');
  }
}
