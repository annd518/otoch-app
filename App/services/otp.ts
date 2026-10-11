declare const __DEV__: boolean;
import type { HttpClient } from "./httpClient";
import { isRecord } from "./apiResult";
import { parseUser } from "./validators";
export const otpApi = (client: HttpClient) => ({
  requestOtp: (phone: string) =>
    client.request<{
      challengeId: string;
      expiresAt: string;
      isMock: boolean;
      testCode?: string;
    }>({
      method: "POST",
      auth: "none",
      path: "/api/auth/otp/request",
      body: { phone },
      parse: (d) =>
        isRecord(d) &&
        typeof d.challengeId === "string" &&
        typeof d.expiresAt === "string"
          ? {
              challengeId: d.challengeId,
              expiresAt: d.expiresAt,
              isMock: d.isMock === true,
              ...(__DEV__ && typeof d.testCode === "string"
                ? { testCode: d.testCode }
                : {}),
            }
          : null,
    }),
  verifyOtp: (
    phone: string,
    challengeId: string,
    code: string,
    name?: string,
  ) =>
    client.request({
      method: "POST",
      auth: "none",
      path: "/api/auth/otp/verify",
      body: { phone, challengeId, code, ...(name && { name }) },
      parse: (d) => {
        if (
          !isRecord(d) ||
          typeof d.token !== "string" ||
          typeof d.refreshToken !== "string"
        )
          return null;
        const user = parseUser(d.user);
        return user
          ? { token: d.token, refreshToken: d.refreshToken, user }
          : null;
      },
    }),
});
