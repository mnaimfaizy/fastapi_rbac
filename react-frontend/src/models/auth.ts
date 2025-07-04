import { User } from './user';

export interface ErrorResponse {
  message: string;
  code?: string;
}

export interface ErrorResponseWithErrors extends ErrorResponse {
  detail?: {
    errors?: string[];
    message?: string;
  };
}

export interface Token {
  access_token: string;
  token_type: string;
  refresh_token: string;
  user: User;
}

export interface TokenRead {
  access_token: string;
  token_type: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

// Add UserRegister interface based on backend UserRegister schema
export interface UserRegister {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  full_name?: string | null;
}

// Add VerifyEmail interface based on backend VerifyEmail schema
export interface VerifyEmail {
  token: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | ErrorResponse | ErrorResponseWithErrors | null;
  passwordChangeSuccess: boolean;
  passwordResetRequested: boolean;
  passwordResetSuccess: boolean;
}
