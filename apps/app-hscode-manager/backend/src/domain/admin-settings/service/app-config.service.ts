import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppSetting } from '../entity/app-setting.entity';
import { SettingItemDto } from '../dto/request/put-settings.request';
import { decryptSecret, encryptSecret, maskSecret } from '../../../common/utils/crypto.util';

export interface SettingView {
  key: string;
  value: string; // 비밀값은 마스킹
  isSecret: boolean;
}

/**
 * 키 이름 자체가 비밀인 설정 — 클라이언트가 is_secret 을 누락/위조해도
 * 서버가 강제로 암호화 저장 + 마스킹 노출한다(POL-005 방어). 레거시 평문 행도 읽기 시 마스킹.
 */
const SECRET_KEYS = new Set<string>(['api_key']);

/** SCR-006 — AI/API 설정 동적 관리 (R-18). 비밀값 암호화 저장 + 마스킹 노출 (POL-005). */
@Injectable()
export class AppConfigService {
  constructor(
    @InjectRepository(AppSetting)
    private readonly repo: Repository<AppSetting>,
  ) {}

  private isSecretKey(key: string): boolean {
    return SECRET_KEYS.has(key);
  }

  async getByCategory(entId: string, category: string): Promise<SettingView[]> {
    const rows = await this.repo.find({ where: { entId, category } });
    return rows.map((r) => ({
      key: r.key,
      value: this.viewValue(r),
      isSecret: r.isSecret || this.isSecretKey(r.key),
    }));
  }

  private viewValue(r: AppSetting): string {
    if (!r.value) return '';
    // 비밀 플래그가 있거나 키 이름이 비밀이면 절대 평문 노출 금지.
    if (!r.isSecret && !this.isSecretKey(r.key)) return r.value;
    // 암호화 저장분은 복호화 후 마스킹, 레거시 평문(복호화 실패)은 원문 대신 마스킹만 노출.
    const plain = this.safeDecrypt(r.value);
    return plain != null ? maskSecret(plain) : maskSecret(r.value);
  }

  async putByCategory(
    entId: string,
    userId: string,
    category: string,
    items: SettingItemDto[],
  ): Promise<SettingView[]> {
    for (const item of items) {
      const existing = await this.repo.findOne({
        where: { entId, category, key: item.key },
      });
      // 알려진 비밀키는 클라이언트 값과 무관하게 암호화 강제(평문 저장 방지).
      const isSecret =
        this.isSecretKey(item.key) || (item.is_secret ?? existing?.isSecret ?? false);

      // 비밀값에 빈 입력이 오면 기존값 유지(마스킹 표시값 재전송 방지)
      if (isSecret && (item.value == null || item.value === '')) {
        continue;
      }

      const storedValue =
        isSecret && item.value != null ? encryptSecret(item.value) : (item.value ?? null);

      if (existing) {
        existing.value = storedValue;
        existing.isSecret = isSecret;
        existing.updatedBy = userId;
        await this.repo.save(existing);
      } else {
        await this.repo.save(
          this.repo.create({
            entId,
            category,
            key: item.key,
            value: storedValue,
            isSecret,
            updatedBy: userId,
          }),
        );
      }
    }
    return this.getByCategory(entId, category);
  }

  /** 평문 비밀값 조회 (런타임 외부 호출용 — 내부 전용, 응답에 노출 금지). */
  async getSecret(entId: string, category: string, key: string): Promise<string | null> {
    const row = await this.repo.findOne({ where: { entId, category, key } });
    if (!row?.value) return null;
    return row.isSecret ? this.safeDecrypt(row.value) : row.value;
  }

  private safeDecrypt(payload: string): string | null {
    try {
      return decryptSecret(payload);
    } catch {
      return null;
    }
  }
}
