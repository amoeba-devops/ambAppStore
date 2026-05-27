'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Save } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@car-v2/ui';
import { updateMemberAction } from '@/server/actions/users/update-member.action';
import { formatActionError } from '@/lib/format-action-error';
import type { AmaMember } from '@/server/services/ama/list-entity-members';

interface EditMemberFormProps {
  member: AmaMember;
}

const ROLES = ['MASTER', 'MANAGER', 'MEMBER', 'VIEWER'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

function normalizePreview(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('84') && digits.length === 11) digits = '0' + digits.slice(2);
  return digits;
}

function isValidVnMobile(phone: string): boolean {
  return /^0[35789]\d{8}$/.test(phone);
}

export function EditMemberForm({ member }: EditMemberFormProps) {
  const router = useRouter();
  const t = useTranslations('users.edit');
  const tCreate = useTranslations('users.create');
  const tStatus = useTranslations('users.statusBadge');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();

  const initialRole = ROLES.includes(member.amaRole as typeof ROLES[number])
    ? (member.amaRole as typeof ROLES[number])
    : 'MEMBER';
  const initialStatus = STATUSES.includes(member.status as typeof STATUSES[number])
    ? (member.status as typeof STATUSES[number])
    : 'ACTIVE';

  const [role, setRole] = useState<typeof ROLES[number]>(initialRole);
  const [status, setStatus] = useState<typeof STATUSES[number]>(initialStatus);
  const [department, setDepartment] = useState(member.unit ?? '');
  const [jobTitle, setJobTitle] = useState(member.jobTitle ?? '');
  const [phone, setPhone] = useState(member.phone ?? '');

  const ROLE_LABELS: Record<typeof ROLES[number], string> = {
    MASTER: tCreate('roleMaster'),
    MANAGER: tCreate('roleManager'),
    MEMBER: tCreate('roleMember'),
    VIEWER: tCreate('roleViewer'),
  };

  const originalPhone = member.phone ?? '';
  const normalizedPhone = normalizePreview(phone);
  const phoneChanged = normalizedPhone !== originalPhone;
  const phoneValid = !phone || isValidVnMobile(normalizedPhone);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone && !phoneValid) {
      toast.error(t('phoneInvalidToast'));
      return;
    }
    startTransition(async () => {
      const res = await updateMemberAction({
        userId: member.userId,
        role,
        status,
        department: department.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        phone: phoneChanged && phone.trim() ? phone.trim() : undefined,
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      toast.success(t('updatedToast', { name: member.name ?? member.email }));
      router.push('/users');
      router.refresh();
    });
  };

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardHeaderText>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeaderText>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
          <div className="rounded-md bg-surface-2 p-3 space-y-2 text-sm">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2">
              <span className="text-text-muted text-xs sm:text-sm">{t('name')}</span>
              <span className="font-medium text-text break-words">{member.name ?? '—'}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2">
              <span className="text-text-muted text-xs sm:text-sm">{t('emailIdLabel')}</span>
              <span className="font-mono text-xs text-text break-all">{member.email}</span>
            </div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
              <span className="text-text-muted text-xs sm:text-sm">{t('level')}</span>
              <Badge tone="neutral" size="sm">{member.levelCode}</Badge>
            </div>
          </div>

          <div>
            <Label htmlFor="phone" className="text-xs">
              {t('phoneLabel')}
            </Label>
            <Input
              id="phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0904567890"
              pattern="[+0-9\s\-]{9,}"
              className={
                'font-mono ' +
                (phone && !phoneValid ? 'border-danger focus-visible:border-danger' : '')
              }
            />
            {phone && !phoneValid && (
              <p className="mt-1 text-xs text-danger">{t('phoneInvalid')}</p>
            )}
          </div>

          <div>
            <Label htmlFor="role">
              {t('role')} <span className="text-danger">*</span>
            </Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-text-muted">{t('roleDesc')}</p>
          </div>

          <div>
            <Label htmlFor="status">
              {t('status')} <span className="text-danger">*</span>
            </Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tStatus(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-text-muted">{t('statusDesc')}</p>
          </div>

          <div>
            <Label htmlFor="department">{t('department')}</Label>
            <Input
              id="department"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder={t('departmentPlaceholder')}
              maxLength={30}
            />
          </div>

          <div>
            <Label htmlFor="jobTitle">{t('jobTitle')}</Label>
            <Input
              id="jobTitle"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder={t('jobTitlePlaceholder')}
              maxLength={100}
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={() => router.push('/users')}
              disabled={pending}
              className="w-full sm:w-auto"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={pending || Boolean(phone && !phoneValid)}
              className="w-full sm:w-auto"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('save')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
