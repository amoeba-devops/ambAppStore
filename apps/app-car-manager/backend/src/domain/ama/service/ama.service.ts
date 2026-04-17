import { Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '../../../common/exceptions/business.exception';

export interface AmaMember {
  userId: string;
  name: string;
  email: string;
  department?: string;
}

@Injectable()
export class AmaService {
  private readonly logger = new Logger(AmaService.name);
  private readonly amaApiBaseUrl =
    process.env.AMA_API_BASE_URL || 'https://stg-ama.amoeba.site';

  async getMembers(token: string, search?: string): Promise<AmaMember[]> {
    const url = new URL(`${this.amaApiBaseUrl}/api/v1/members`);
    if (search) {
      url.searchParams.set('search', search);
    }

    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        this.logger.warn(`AMA members API returned ${res.status}`);
        throw new BusinessException(
          'CAR-E9001',
          `AMA API error: ${res.status}`,
          res.status >= 500 ? 502 : res.status,
        );
      }

      const body = await res.json();
      const members = body?.data || body || [];

      if (!Array.isArray(members)) {
        return [];
      }

      return members.map((m: Record<string, unknown>) => ({
        userId: (m.userId || m.usr_id || m.id || '') as string,
        name: (m.name || m.usr_name || '') as string,
        email: (m.email || m.usr_email || '') as string,
        department: (m.department || m.unit_name || '') as string,
      }));
    } catch (err) {
      if (err instanceof BusinessException) throw err;
      this.logger.error(`AMA members fetch error: ${(err as Error).message}`);
      throw new BusinessException('CAR-E9002', 'Failed to connect to AMA server', 502);
    }
  }
}
