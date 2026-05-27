'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Save, Copy, Check, Mail, KeyRound } from 'lucide-react';
import {
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
import { addMemberAction, type AddMemberResult } from '@/server/actions/users/add-member.action';
import { formatActionError } from '@/lib/format-action-error';
import type { LocalRole } from '@car-v2/shared/auth';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

interface AddMemberFormProps {
  actorRole: LocalRole;
}

export function AddMemberForm({ actorRole }: AddMemberFormProps) {
  const router = useRouter();
  const t = useTranslations('users.create');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'MASTER' | 'MANAGER' | 'MEMBER' | 'VIEWER'>(
    actorRole === 'ADMIN' ? 'MANAGER' : 'MEMBER',
  );
  const [department, setDepartment] = useState('');
  const [result, setResult] = useState<AddMemberResult | null>(null);
  const [copied, setCopied] = useState(false);

  const ALL_ROLES = [
    { value: 'MASTER' as const, label: t('roleMaster'), driverEligible: false },
    { value: 'MANAGER' as const, label: t('roleManager'), driverEligible: false },
    { value: 'MEMBER' as const, label: t('roleMember'), driverEligible: true },
    { value: 'VIEWER' as const, label: t('roleViewer'), driverEligible: true },
  ];
  const availableRoles = ALL_ROLES.filter((r) =>
    actorRole === 'ADMIN' ? true : r.driverEligible,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!isValidEmail(trimmedEmail)) {
      toast.error(t('invalidEmail'), { description: t('invalidEmailDesc') });
      return;
    }

    startTransition(async () => {
      const res = await addMemberAction({
        name: name.trim(),
        email: trimmedEmail,
        role,
        department: department.trim() || undefined,
      });
      if (!res.success) {
        toast.error(formatActionError(res.error, tErr));
        return;
      }
      setResult(res.data);
      toast.success(t('createdToast', { name: res.data.name }));
    });
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.emailTemplate);
      setCopied(true);
      toast.success(t('successCopyToast'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('successCopyFail'));
    }
  };

  if (result) {
    const mailtoUrl = `mailto:${result.email}?subject=${encodeURIComponent(
      t('emailSubject', { name: result.name, entName: result.entName }),
    )}&body=${encodeURIComponent(result.emailTemplate)}`;
    return (
      <Card variant="elevated">
        <CardHeader>
          <CardHeaderText>
            <CardTitle>{t('successTitle', { name: result.name })}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-success-soft text-success-strong text-sm p-3 leading-relaxed">
            <div>
              {t.rich('successDesc', {
                name: result.name,
                entName: result.entName,
                role: result.role,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </div>
            <div className="mt-1 text-xs">
              {t.rich('successCredentials', {
                email: result.email,
                entCode: result.entCode,
                code: (chunks) => <code className="font-mono">{chunks}</code>,
              })}
            </div>
          </div>

          <div>
            <Label>{t('successEmailLabel', { name: result.name })}</Label>
            <textarea
              readOnly
              value={result.emailTemplate}
              rows={6}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 p-3 text-sm font-mono whitespace-pre-wrap"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handleCopy} variant="accent" size="md">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? t('successCopyDone') : t('successCopyButton')}
              </Button>
              <Button asChild variant="secondary" size="md">
                <a href={mailtoUrl}>
                  <Mail className="h-4 w-4" />
                  {t('successOpenMail')}
                </a>
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setResult(null)}>
              {t('successAddOther')}
            </Button>
            <Button variant="secondary" onClick={() => router.push('/users')}>
              {t('successBackList')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardHeaderText>
          <CardTitle>{t('title')}</CardTitle>
        </CardHeaderText>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">
              {t('fullName')} <span className="text-danger">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('fullNamePlaceholder')}
              maxLength={50}
            />
          </div>

          <div className="rounded-md border-2 border-danger/40 bg-danger-soft/30 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <KeyRound className="h-5 w-5 text-danger shrink-0 mt-0.5" aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-danger">
                  {t('emailLoginTitle')}
                </div>
                <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                  {t('emailLoginDesc')}
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="email" className="text-xs">
                Email <span className="text-danger">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                inputMode="email"
                autoComplete="off"
                maxLength={255}
                className={
                  'font-mono ' +
                  (email && !isValidEmail(email.trim().toLowerCase())
                    ? 'border-danger focus-visible:border-danger'
                    : '')
                }
              />
              <div className="mt-1.5 text-xs flex items-center justify-between gap-2 flex-wrap">
                <span className="text-text-faint">{t('emailFormatHint')}</span>
                {email && (
                  <span
                    className={
                      'font-mono tabular ' +
                      (isValidEmail(email.trim().toLowerCase())
                        ? 'text-success font-semibold'
                        : 'text-danger')
                    }
                  >
                    {isValidEmail(email.trim().toLowerCase())
                      ? t('emailValid', { email: email.trim().toLowerCase() })
                      : t('emailInvalid')}
                  </span>
                )}
              </div>
            </div>
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
                {availableRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {actorRole === 'MANAGER' && (
              <p className="mt-1 text-xs text-text-muted">{t('managerHint')}</p>
            )}
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

          <div className="flex justify-end gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.push('/users')}
              disabled={pending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
