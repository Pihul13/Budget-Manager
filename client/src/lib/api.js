const apiBaseUrl = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
let tokenProvider = null;

export function setTokenProvider(provider) {
  tokenProvider = provider;
}

async function request(url, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = tokenProvider ? await tokenProvider() : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${apiBaseUrl}${url}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const api = {
  get: (url) => request(url),
  post: (url, body) =>
    request(url, { method: "POST", body: JSON.stringify(body) }),
  put: (url, body) =>
    request(url, { method: "PUT", body: JSON.stringify(body) }),
  del: (url) => request(url, { method: "DELETE" }),
};

export async function downloadBackup() {
  const headers = new Headers();
  const token = tokenProvider ? await tokenProvider() : null;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${apiBaseUrl}/api/backup/export`, { headers });
  if (!res.ok) throw new Error("Backup export failed.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "personal-finance-backup.json";
  a.click();
  URL.revokeObjectURL(url);
}
