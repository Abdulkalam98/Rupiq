const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function request(path: string, options: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "API error");
  }
  return res.json();
}

function withUser(userId: string) {
  return { "x-user-id": userId };
}

// ── Gmail ──
export const gmail = {
  connect: (userId: string) =>
    request("/api/gmail/connect", { headers: withUser(userId) }),
  status: (userId: string) =>
    request("/api/gmail/status", { headers: withUser(userId) }),
  disconnect: (userId: string) =>
    request("/api/gmail/disconnect", { method: "DELETE", headers: withUser(userId) }),
  scan: (userId: string) =>
    request("/api/gmail/scan", { method: "POST", headers: withUser(userId) }),
  scanStatus: (userId: string, jobId: string) =>
    request(`/api/gmail/scan/status/${jobId}`, { headers: withUser(userId) }),
  scanHistory: (userId: string) =>
    request("/api/gmail/scan/history", { headers: withUser(userId) }),
};

// ── Upload ──
export const upload = {
  pdf: async (userId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/api/upload/pdf`, {
      method: "POST",
      headers: { "x-user-id": userId },
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Upload failed" }));
      throw new Error(err.detail);
    }
    return res.json();
  },
  history: (userId: string) =>
    request("/api/upload/history", { headers: withUser(userId) }),
};

// ── Analysis ──
export const analysis = {
  analyse: (userId: string, uploadIds: string[]) =>
    request("/api/analysis/analyse", {
      method: "POST",
      headers: withUser(userId),
      body: JSON.stringify({ upload_ids: uploadIds }),
    }),
  latest: (userId: string) =>
    request("/api/analysis/latest", { headers: withUser(userId) }),
  get: (userId: string, id: string) =>
    request(`/api/analysis/${id}`, { headers: withUser(userId) }),
  history: (userId: string) =>
    request("/api/analysis/", { headers: withUser(userId) }),
};
