import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  findByGmailAddress(gmailAddress: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { gmailAddress } });
  }

  create(email: string, passwordHash: string, role: UserRole): Promise<User> {
    const user = this.usersRepository.create({ email, passwordHash, role });
    return this.usersRepository.save(user);
  }

  async saveGoogleLink(
    userId: string,
    data: { refreshToken: string; gmailAddress: string },
  ): Promise<void> {
    await this.usersRepository.update(userId, {
      googleRefreshToken: data.refreshToken,
      gmailAddress: data.gmailAddress,
    });
  }

  async saveGmailHistoryId(userId: string, historyId: string): Promise<void> {
    await this.usersRepository.update(userId, { gmailHistoryId: historyId });
  }
}
