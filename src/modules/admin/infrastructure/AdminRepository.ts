import { AdminUser, PrismaClient } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import { IAdminRepository } from '../domain/IAdminRepository';

export class AdminRepository implements IAdminRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findByEmail(email: string): Promise<AdminUser | null> {
    return this.db.adminUser.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<AdminUser | null> {
    return this.db.adminUser.findUnique({ where: { id } });
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.db.adminUser.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }
}

export const adminRepository = new AdminRepository();
