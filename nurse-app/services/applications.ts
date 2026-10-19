// "Join as a nurse" request (server/src/routes/nurseApplications.ts). No sign-in needed:
// a nurse account is created by an admin only after the licence and documents are checked.
import { API_PATHS } from '../config/api'
import { isRecord } from './apiResult'
import type { HttpClient } from './httpClient'
import type { ValidApplication } from '../utils/registration'

export function submitApplication(client: HttpClient, application: ValidApplication) {
  return client.request<true>({
    method: 'POST',
    auth: 'none',
    path: API_PATHS.applications.create,
    body: {
      name: application.name,
      phone: application.phone,
      licenseNo: application.licenseNo,
      experienceYears: application.experienceYears,
      // The three statements are confirmed on the form; the button stays off until they are.
      declarations: { license: true, experience: true, scope: true },
    },
    parse: (d) => (isRecord(d) && d.received === true ? true : null),
  })
}
