import { PrismaClient, User } from '@prisma/client';
import { prisma } from '../../../infrastructure/database/prisma';
import { CreateUserInput, IUserRepository } from '../domain/IUserRepository';

export class UserRepository implements IUserRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  findByContact(contact: string): Promise<User | null> {
    return this.db.user.findFirst({
      where: { OR: [{ email: contact }, { phone: contact }] },
    });
  }

  create(input: CreateUserInput): Promise<User> {
    return this.db.user.create({ data: input });
  }
}

export const userRepository = new UserRepository();
