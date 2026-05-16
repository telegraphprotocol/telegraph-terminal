const MAX_BODY_LOG = 500;

function formatErr(err: unknown): string {
  if (err instanceof Error) {
    let cause = "";
    if (err.cause instanceof Error) {
      cause = err.cause.message;
    } else if (err.cause !== undefined && err.cause !== null) {
      cause = typeof err.cause === "string" ? err.cause : JSON.stringify(err.cause);
    }
    return cause ? `${err.message} (cause: ${cause})` : err.message;
  }
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** Config / validation errors before upstream fetch. */
export function logApiProxyConfig(tag: string, message: string): void {
  console.error(`[api-proxy ${tag}] ${message}`);
}

/** Network / DNS / connection failures calling upstream. */
export function logApiProxyFetchError(tag: string, url: string, err: unknown): void {
  console.error(`[api-proxy ${tag}] fetch failed`, { url, error: formatErr(err) });
}

/** Upstream returned an HTTP error status (body truncated for logs). */
export function logApiProxyUpstreamError(
  tag: string,
  url: string,
  status: number,
  bodyText: string,
): void {
  if (status < 400) return;
  const body =
    bodyText.length > MAX_BODY_LOG ? `${bodyText.slice(0, MAX_BODY_LOG)}…` : bodyText;
  console.error(`[api-proxy ${tag}] upstream HTTP ${status}`, { url, body });
}
