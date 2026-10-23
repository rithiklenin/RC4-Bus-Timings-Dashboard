export const ADMIN_AUTH_COOKIE = "rc4-admin-session";
const MOCK_SESSION_VALUE = "mock-nus-session-v1";

export interface AdminAuthProvider {
  id: string;
  label: string;
  loginEndpoint: string;
}

// Replace this adapter and the login route when an official NUS auth client is available.
export const ADMIN_AUTH_PROVIDER: AdminAuthProvider = {
  id: "mock-nus",
  label: "Continue with NUS email",
  loginEndpoint: "/api/admin-auth/login",
};

export function createAdminSession() {
  return MOCK_SESSION_VALUE;
}

export function isValidAdminSession(value: string | undefined) {
  return value === MOCK_SESSION_VALUE;
}
