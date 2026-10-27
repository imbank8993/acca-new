import { PresenceService } from '../presence/presence.service';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(private readonly prisma: PrismaService, private readonly presence: PresenceService) {}

  async getActivityLogs(page: number, limit: number) {
    try {
      const offset = (page - 1) * limit;

      const logs = await this.prisma.activity_logs.findMany({
        select: {
          id: true,
          action: true,
          details: true,
          created_at: true,
          user_id: true,
        },
        orderBy: {
          created_at: 'desc',
        },
        skip: offset,
        take: limit,
      });

      if (logs && logs.length > 0) {
        const userIds = Array.from(new Set(logs.map(log => log.user_id).filter((id): id is string => !!id)));

        if (userIds.length > 0) {
          const users = await this.prisma.public_users.findMany({
            select: {
              auth_id: true,
              nama: true,
              role: true,
              foto_profil: true,
            },
            where: {
              auth_id: {
                in: userIds,
              },
            },
          });

          const userMap = new Map(users.map(u => [u.auth_id, u]));

          const logsWithUser = logs.map(log => ({
            ...log,
            users: userMap.get(log.user_id) || { nama: 'Unknown', role: 'Unknown', foto_profil: null as string | null },
          }));

          return logsWithUser;
        }
      }

      return logs;
    } catch (error) {
      this.logger.error(`Error fetching activity logs: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getUsers() {
    try {
      const users = await this.prisma.public_users.findMany({
        select: {
          id: true,
          nama: true,
          nip: true,
          role: true,
          last_seen: true,
          foto_profil: true,
          last_location: true,
          created_at: true,
        },
        orderBy: {
          last_seen: { sort: 'desc', nulls: 'last' },
        },
      });

      const siswaUsers = users.filter((u: any) => {
        const roles = u.role ? u.role.split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean) : [];
        return roles.includes('SISWA');
      });
      const siswaNips = siswaUsers.map((u: any) => u.nip).filter(Boolean);

      let kelasMap: Record<string, string> = {};
      if (siswaNips.length > 0) {
        try {
          const taRows = await this.prisma.master_tahun_ajaran.findMany({
            where: { is_active: true },
            select: { tahun_ajaran: true },
          });
          const activeYears = [...new Set(taRows.map(t => t.tahun_ajaran))];

          const masterKelas = await this.prisma.master_kelas.findMany({
            select: { nama: true, program: true },
          });
          const programMap = new Map(masterKelas.map(mk => [mk.nama, (mk.program || '').toLowerCase()]));

          const skWhere: any = {
            nisn: { in: siswaNips },
            aktif: true,
          };
          
          if (activeYears.length > 0) {
            skWhere.tahun_ajaran = { in: activeYears };
          }

          const allSkData = await this.prisma.siswa_kelas.findMany({
            where: skWhere,
            select: { nisn: true, kelas: true },
            orderBy: { created_at: 'desc' },
          });

          let fallbackMap: Record<string, string> = {};
          if (allSkData.length > 0) {
            for (const row of allSkData) {
              if (row.nisn && row.kelas) {
                const p = programMap.get(row.kelas) || '';
                const isReguler = p === 'reguler' || p === '' || p === 'umum';

                const pLower = p.toLowerCase();
                const namaLower = row.kelas.toLowerCase();
                if (
                  pLower.includes('utbk') ||
                  pLower.includes('peminatan') ||
                  pLower.includes('ekskul') ||
                  namaLower.includes('utbk')
                ) {
                  continue;
                }

                if (isReguler && !kelasMap[row.nisn]) {
                  kelasMap[row.nisn] = row.kelas;
                }
                if (!fallbackMap[row.nisn]) {
                  fallbackMap[row.nisn] = row.kelas;
                }
              }
            }

            for (const nisn of siswaNips) {
              if (!kelasMap[nisn] && fallbackMap[nisn]) {
                kelasMap[nisn] = fallbackMap[nisn];
              }
            }
          }
        } catch (e) {
          this.logger.warn(`siswa_kelas query skipped: ${e.message}`);
        }
      }

      const now = new Date();
      const onlineUsers = this.presence.onlineUsers();
      const processedUsers = users.map((user: any) => {
        const isOnline = onlineUsers.has(String(user.id));
        let lastSeenText = user.created_at
          ? `Terdaftar sejak ${new Date(user.created_at).toLocaleDateString('id-ID')}`
          : 'Belum pernah login';

        const rolesArray = user.role
          ? user.role.split(/[,|]/).map((r: string) => r.trim().toUpperCase()).filter(Boolean)
          : [];

        if (user.last_seen) {
          const lastSeenDate = new Date(user.last_seen);
          const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / 1000 / 60;


          if (diffMinutes < 1) lastSeenText = 'Baru saja';
          else if (diffMinutes < 60) lastSeenText = `${Math.floor(diffMinutes)} menit lalu`;
          else if (diffMinutes < 1440) lastSeenText = `${Math.floor(diffMinutes / 60)} jam lalu`;
          else lastSeenText = lastSeenDate.toLocaleDateString('id-ID');
        }

        return {
          ...user,
          kelas: kelasMap[user.nip] || null,
          is_online: isOnline,
          last_seen_text: lastSeenText,
          roles: rolesArray,
          role: user.role || 'User',
        };
      });

      return processedUsers;
    } catch (error) {
      this.logger.error(`Error fetching users: ${error.message}`, error.stack);
      throw error;
    }
  }
}
