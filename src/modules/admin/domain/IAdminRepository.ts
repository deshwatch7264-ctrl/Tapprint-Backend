import { AdminUser } from '@prisma/client';

export interface IAdminRepository {
  findByEmail(email: string): Promise<AdminUser | null>;
  findById(id: string): Promise<AdminUser | null>;
  updateLastLogin(id: string): Promise<void>;
}
