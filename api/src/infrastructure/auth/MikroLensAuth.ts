import type { CreateTokenRequest } from "mikroauth";

export interface MikroLensAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  exp: number;
  tokenType: string;
}

export interface MikroLensAuthPayload {
  email?: string;
  exp?: number;
  iat?: number;
  jti?: string;
  lastLogin?: number;
  metadata?: {
    ip?: string;
  };
  role?: string;
  sub?: string;
  username?: string;
}

export interface MikroLensAuthGateway {
  createToken(input: CreateTokenRequest): Promise<MikroLensAuthTokenResponse>;
  logout(refreshToken: string): Promise<{ message: string }>;
  refreshAccessToken(refreshToken: string): Promise<MikroLensAuthTokenResponse>;
  verify(accessToken: string): MikroLensAuthPayload;
}
