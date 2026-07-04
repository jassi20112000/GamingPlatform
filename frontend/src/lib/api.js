const API_URL = import.meta.env.VITE_API_URL
  || (window.location.hostname === "localhost" ? "http://localhost:4000" : "https://gamingplatform-cja3.onrender.com");

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
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new Error("Server connection failed. Please try again in a moment.");
  }
  const text = await response.text();
  const data = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  })() : {};
  if (!response.ok) {
    throw new Error(data.message || `Service unavailable (${response.status})`);
  }
  return data;
}
