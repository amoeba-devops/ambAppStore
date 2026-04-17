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

  async getMembers(token: string, entityId: string, search?: string): Promise<AmaMember[]> {
    // Try multiple AMA endpoint patterns
    const endpoints = [
      this.buildUrl('/api/v1/members', { entity_id: entityId, search }),
      this.buildUrl('/api/v1/hr/employees', { entity_id: entityId, search }),
      this.buildUrl('/api/v1/members', { ent_id: entityId, search }),
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (res.status === 404) continue; // Try next endpoint
        if (res.status === 403) {
          const errorBody = await res.text().catch(() => '');
          this.logger.warn(`AMA API ${url} returned 403: ${errorBody}`);
          continue; // Try next endpoint
        }

        if (!res.ok) {
          const errorBody = await res.text().catch(() => '');
          this.logger.warn(`AMA API ${url} returned ${res.status}: ${errorBody}`);
          continue;
        }

        const body = await res.json();
        const rawMembers = body?.data || body || [];

        if (!Array.isArray(rawMembers)) return [];

        return rawMembers.map((m: Record<string, unknown>) => ({
          userId: (m.userId || m.usr_id || m.id || m.sub || '') as string,
          name: (m.name || m.usr_name || m.fullName || '') as string,
          email: (m.email || m.usr_email || '') as string,
          department: (m.department || m.unit_name || m.dept || '') as string,
        }));
      } catch (err) {
        if (err instanceof BusinessException) throw err;
        this.logger.error(`AMA fetch error for ${url}: ${(err as Error).message}`);
        continue;
      }
    }

    // All endpoints failed — return empty instead of crashing
    this.logger.warn(`All AMA member endpoints failed for entity ${entityId}. Returning empty list.`);
    return [];
  }

  private buildUrl(path: string, params: Record<string, string | undefined>): string {
    const url = new URL(`${this.amaApiBaseUrl}${path}`);
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
    return url.toString();
  }
}
