type Role = 'CHILD' | 'NURSE' | 'MEDICAL_ADMIN' | 'ADMIN'

export interface JWTPayload {
    userId: string
    email: string
    role: Role
}

export interface AuthenticatedRequest extends Request {
    user?: JWTPayload
}

export interface ApiResponse<T = any> {
    success: boolean
    message: string
    data?: T
    errors?: any[]
}