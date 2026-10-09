/** A failed read is different from an empty collection or a missing place.
 * Keep transport bodies (which can contain account data) out of UI errors. */
export class DataReadError extends Error {
  override readonly name = "DataReadError";

  constructor(
    readonly source: string,
    readonly code: "unavailable" | "invalid_data" = "unavailable",
  ) {
    super(`DATA_READ_${code.toUpperCase()}:${source}`);
  }
}

/** AbortSignal.timeout is not available in every supported native runtime.
 * Race the read as well: a transport that ignores abort must still release UI. */
export async function withReadTimeout<T>(source: string, read: (signal: AbortSignal) => PromiseLike<T>): Promise<T> {
  const abort = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      abort.abort();
      reject(new DataReadError(source));
    }, 15_000);
  });
  try {
    return await Promise.race([read(abort.signal), deadline]);
  } catch (error) {
    if (error instanceof DataReadError) throw error;
    throw new DataReadError(source);
  } finally {
    clearTimeout(timer);
  }
}
