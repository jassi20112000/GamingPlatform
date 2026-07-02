const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export function getToken() {
  return localStorage.getItem("gaming_token");
}

export function setToken(token) {
  localStorage.setItem("gaming_token", token);
}

export function clearToken() {
  localStorage.removeItem("gaming_token");
}

export async function api(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || "Something went wrong");
  }
  return data;
}
