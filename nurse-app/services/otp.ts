import { API_PATHS } from '../config/api'
import { isRecord } from './apiResult'
import type { HttpClient } from './httpClient'

export interface OtpChallenge {
  challengeId: string
  expiresAt: string
  resendAfterSeconds: number
}

export const OTP_RESEND_SECONDS = 60

export function requestOtp(client: HttpClient, phone: string) {
  return client.request<OtpChallenge>({
    method: 'POST',
    auth: 'none',
    path: API_PATHS.auth.otpRequest,
    body: { phone },
    parse: (d) =>
      isRecord(d) && typeof d.challengeId === 'string' && typeof d.expiresAt === 'string'
        ? {
            challengeId: d.challengeId,
            expiresAt: d.expiresAt,
            resendAfterSeconds: typeof d.resendAfterSeconds === 'number' ? d.resendAfterSeconds : OTP_RESEND_SECONDS,
          }
        : null,
  })
}
