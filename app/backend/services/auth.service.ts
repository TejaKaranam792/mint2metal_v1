import { prisma } from '../prisma';
import { UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import speakeasy from 'speakeasy';
import qrcode from 'qrcode';
import { z } from 'zod';
import { AuditService, AuditAction } from './audit.service';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  twoFactorCode: z.string().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  country: z.string(),
});

export class AuthService {
  static async register(data: z.infer<typeof registerSchema>) {
    const { email, password, country } = registerSchema.parse(data);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new Error('User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        country,
        role: country.toLowerCase() === 'india' ? UserRole.INDIA_USER : UserRole.INTERNATIONAL_USER,
      },
    });

    // Log user registration
    await AuditService.logAction(
      user.id,
      AuditAction.USER_REGISTERED,
      undefined,
      { country, email },
      undefined,
      undefined
    );

    return { id: user.id, email: user.email, role: user.role, country: user.country };
  }

  static async login(data: z.infer<typeof loginSchema>) {
    const { email, password, twoFactorCode } = loginSchema.parse(data);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.password) {
      throw new Error('Invalid credentials');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Check if 2FA is enabled
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        return { requiresTwoFactor: true, userId: user.id };
      }

      const isValidToken = speakeasy.totp.verify({
        secret: user.twoFactorSecret!,
        encoding: 'base32',
        token: twoFactorCode,
      });

      if (!isValidToken) {
        throw new Error('Invalid 2FA code');
      }
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        country: user.country,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  static async setupTwoFactor(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new Error('2FA already enabled');
    }

    const secret = speakeasy.generateSecret({
      name: `Mint2Metal (${user.email})`,
      issuer: 'Mint2Metal',
    });

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url!);

    return {
      secret: secret.base32,
      qrCodeUrl,
    };
  }

  static async enableTwoFactor(userId: string, secret: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const isValidToken = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
    });

    if (!isValidToken) {
      throw new Error('Invalid 2FA token');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      },
    });

    return { success: true };
  }

  static async disableTwoFactor(userId: string, token: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorEnabled) {
      throw new Error('2FA not enabled');
    }

    const isValidToken = speakeasy.totp.verify({
      secret: user.twoFactorSecret!,
      encoding: 'base32',
      token,
    });

    if (!isValidToken) {
      throw new Error('Invalid 2FA token');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    return { success: true };
  }

  static async verifyToken(token: string) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
      const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
      if (!user) {
        throw new Error('User not found');
      }
      return {
        id: user.id,
        email: user.email,
        role: user.role,
        country: user.country,
        twoFactorEnabled: user.twoFactorEnabled,
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static async getUserFromToken(req: any) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
      return null;
    }
    try {
      return await AuthService.verifyToken(token);
    } catch (error) {
      return null;
    }
  }
}

export const getUserFromToken = AuthService.getUserFromToken;
