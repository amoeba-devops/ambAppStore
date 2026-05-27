import 'server-only';
import { MOCK_AMA_MEMBERS } from '@/lib/users-mock';

export type AmaRole = 'OWNER' | 'MASTER' | 'MANAGER' | 'MEMBER';
export type AmaStatus = 'ACTIVE' | 'INACTIVE';

export interface AmaMember {
  amaUserId: string;
  email: string;
  name: string | null;
  amaRole: AmaRole;
  amaStatus: AmaStatus;
}

export interface AmaClient {
  fetchEntityMembers(entId: string): Promise<AmaMember[]>;
}

class MockAmaClient implements AmaClient {
  async fetchEntityMembers(_entId: string): Promise<AmaMember[]> {
    return MOCK_AMA_MEMBERS.map((m) => ({
      amaUserId: m.amaUserId,
      email: m.email,
      name: m.name,
      amaRole: m.amaRole,
      amaStatus: 'ACTIVE' as const,
    }));
  }
}

class HttpAmaClient implements AmaClient {
  constructor(
    private readonly baseUrl: string,
    private readonly token: string,
  ) {}

  async fetchEntityMembers(_entId: string): Promise<AmaMember[]> {
    throw new Error(
      'HttpAmaClient not implemented yet — Phase 2. Unset AMA_API_BASE_URL to use MockAmaClient.',
    );
  }
}

export function createAmaClient(): AmaClient {
  const baseUrl = process.env.AMA_API_BASE_URL;
  const token = process.env.AMA_API_TOKEN;
  if (baseUrl && token) {
    return new HttpAmaClient(baseUrl, token);
  }
  return new MockAmaClient();
}
