export async function api(path, options) {
  const response = await fetch(`/api${path}`, options);
  if (!response.ok) {
    let data;
    try {
      data = await response.json();
    } catch {
      /* Use the connection error below. */
    }
    throw new Error(
      data?.error || "Unable to connect to the quotation server.",
    );
  }
  return response.json();
}
