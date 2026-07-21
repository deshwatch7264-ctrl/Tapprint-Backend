import { randomUUID } from 'crypto';
import { StationStatus } from '@prisma/client';
import { config } from '../../../config';
import { passwordService } from '../../../infrastructure/auth/PasswordService';
import { tokenService } from '../../../infrastructure/auth/TokenService';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthenticatedError,
} from '../../../shared/errors/http-errors';
import { IAdminRepository } from '../../admin/domain/IAdminRepository';
import { adminRepository } from '../../admin/infrastructure/AdminRepository';
import { IStationRepository } from '../../stations/domain/IStationRepository';
import { stationRepository } from '../../stations/infrastructure/StationRepository';

export interface AdminLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: { id: string; email: string; fullName: string; role: string };
}

export interface SessionResult {
  sessionToken: string;
  expiresIn: number;
  station: { id: string; name: string; status: StationStatus };
}

/**
 * Authentication use cases for all three principal types.
 */
export class AuthService {
  constructor(
    private readonly admins: IAdminRepository = adminRepository,
    private readonly stations: IStationRepository = stationRepository,
  ) {}

  async adminLogin(email: string, password: string): Promise<AdminLoginResult> {
    const admin = await this.admins.findByEmail(email);
    if (!admin || !admin.isActive) {
      throw new UnauthenticatedError('Invalid credentials');
    }
    const ok = await passwordService.compare(password, admin.passwordHash);
    if (!ok) {
      throw new UnauthenticatedError('Invalid credentials');
    }

    await this.admins.updateLastLogin(admin.id);

    const accessToken = tokenService.signAdminAccess({
      sub: admin.id,
      type: 'admin',
      role: admin.role,
      email: admin.email,
    });
    const refreshToken = tokenService.signAdminRefresh(admin.id);

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.accessTtl,
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
      },
    };
  }

  async refreshAdmin(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    const { sub } = tokenService.verifyRefresh(refreshToken);
    const admin = await this.admins.findById(sub);
    if (!admin || !admin.isActive) {
      throw new ForbiddenError('Account is not active');
    }
    const accessToken = tokenService.signAdminAccess({
      sub: admin.id,
      type: 'admin',
      role: admin.role,
      email: admin.email,
    });
    return { accessToken, expiresIn: config.jwt.accessTtl };
  }

  async startCustomerSession(stationSlug: string): Promise<SessionResult> {
    const station = await this.stations.findBySlug(stationSlug);
    if (!station) {
      throw new NotFoundError('Station not found');
    }
    if (station.status !== StationStatus.active) {
      throw new ConflictError(`Station is currently ${station.status}`);
    }

    // A unique session id per scan. This isolates each customer's rate-limit
    // bucket and is the ownership key for their uploads and jobs.
    const sessionToken = tokenService.signCustomerSession({
      sub: `sess_${randomUUID()}`,
      type: 'customer',
      stationId: station.id,
    });

    return {
      sessionToken,
      expiresIn: config.jwt.sessionTtl,
      station: { id: station.id, name: station.name, status: station.status },
    };
  }
}

export const authService = new AuthService();
