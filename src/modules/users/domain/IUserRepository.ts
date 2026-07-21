import { User } from '@prisma/client';

export interface CreateUserInput {
  phone?: string;
  email?: string;
  displayName?: string;
  isGuest: boolean;
}

export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByContact(contact: string): Promise<User | null>;
  create(input: CreateUserInput): Promise<User>;
}
