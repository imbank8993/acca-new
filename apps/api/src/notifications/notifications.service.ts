import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(role?: string, userId?: string) {
    try {
      const where: any = { is_active: true };

      if (role || userId) {
        const orConditions: any[] = [
          { recipient_role: null, recipient_user_id: null },
        ];

        if (role) {
          const roles = role.split(',').map((r) => r.trim()).filter(Boolean);
          roles.forEach((r) => {
            orConditions.push({ recipient_role: { contains: r, mode: 'insensitive' } });
          });
        }

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (userId && uuidRegex.test(userId)) {
          orConditions.push({ recipient_user_id: userId });
        }

        where.OR = orConditions;
      }

      const data = await this.prisma.notifications.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: 50,
      });

      return {
        ok: true,
        data: data.map((d) => ({
          ...d,
          created_at: d.created_at ? d.created_at.toISOString() : new Date().toISOString(),
        })),
      };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }

  async createNotification(body: any, user?: any) {
    const { type, title, message, link } = body;
    if (!type || !title) {
      throw new BadRequestException('Type dan title wajib diisi');
    }

    try {
      const data = await this.prisma.notifications.create({
        data: {
          type,
          title,
          message: message || null,
          link: link || null,
          created_by: user?.sub || user?.id || null,
          is_active: true,
        },
      });

      return {
        ok: true,
        data: {
          ...data,
          created_at: data.created_at ? data.created_at.toISOString() : new Date().toISOString(),
        },
      };
    } catch (error: any) {
      throw new InternalServerErrorException(error.message);
    }
  }
}
