let csrfToken = "";
export function setCsrfToken(value) {
  csrfToken = value || "";
}

export async function api(path, options) {
  const headers = new Headers(options?.headers);
  if (options?.body && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: "same-origin",
    headers,
  });
  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      /* Use the connection error below. */
    }
    const error = new Error(
      data?.error || "Unable to connect to the quotation server.",
    );
    error.status = response.status;
    if (response.status === 401 && !path.startsWith("/auth/"))
      window.dispatchEvent(new Event("session-expired"));
    throw error;
  }
  return response.json();
}
