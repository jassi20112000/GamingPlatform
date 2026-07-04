const fallbackApiUrl = "https://gamingplatform-cja3.onrender.com";
const primaryApiUrl = import.meta.env.VITE_API_URL
  || (window.location.hostname === "localhost" ? "http://localhost:4000" : fallbackApiUrl);
const apiUrls = primaryApiUrl === fallbackApiUrl ? [primaryApiUrl] : [primaryApiUrl, fallbackApiUrl];

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
  for (const url of apiUrls) {
    try {
      response = await fetch(`${url}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(options.headers || {})
        }
      });
      break;
    } catch {
      response = null;
    }
  }
  if (!response) {
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
