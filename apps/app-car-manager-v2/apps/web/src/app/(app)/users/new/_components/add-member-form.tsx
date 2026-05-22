'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, Copy, Check, MessageCircle, KeyRound } from 'lucide-react';
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
import type { LocalRole } from '@car-v2/shared/auth';

/** Mirror AMA normalize — chỉ preview, server validate lại. */
function normalizePreview(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('84') && digits.length === 11) digits = '0' + digits.slice(2);
  return digits;
}
function isValidVnMobile(phone: string): boolean {
  return /^0[35789]\d{8}$/.test(phone);
}

interface AddMemberFormProps {
  actorRole: LocalRole;
}

const ALL_ROLES = [
  { value: 'MASTER', label: 'Master (Quản trị cấp cao)', driverEligible: false },
  { value: 'MANAGER', label: 'Manager (Quản lý)', driverEligible: false },
  { value: 'MEMBER', label: 'Driver (Tài xế)', driverEligible: true },
  { value: 'VIEWER', label: 'Viewer (Chỉ xem)', driverEligible: true },
] as const;

export function AddMemberForm({ actorRole }: AddMemberFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'MASTER' | 'MANAGER' | 'MEMBER' | 'VIEWER'>(
    actorRole === 'ADMIN' ? 'MANAGER' : 'MEMBER',
  );
  const [department, setDepartment] = useState('');
  const [result, setResult] = useState<AddMemberResult | null>(null);
  const [copied, setCopied] = useState(false);

  // MANAGER chỉ tạo được DRIVER (MEMBER/VIEWER)
  const availableRoles = ALL_ROLES.filter((r) =>
    actorRole === 'ADMIN' ? true : r.driverEligible,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    /* Pre-send validation — chuẩn hoá VN phone + check format trước khi gọi action.
     * Đây là login key, sai = user mất khả năng login → cần feedback ngay
     * thay vì để server reject sau round-trip. */
    const canonical = normalizePreview(phone);
    if (!isValidVnMobile(canonical)) {
      toast.error('Số điện thoại không hợp lệ', {
        description: 'Yêu cầu 10 chữ số bắt đầu 03/05/07/08/09 (VN mobile).',
      });
      return;
    }

    startTransition(async () => {
      const res = await addMemberAction({
        name: name.trim(),
        phone: canonical,
        role,
        department: department.trim() || undefined,
      });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      setResult(res.data);
      toast.success(`Đã tạo ${res.data.name}`);
    });
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.smsTemplate);
      setCopied(true);
      toast.success('Đã copy nội dung tin nhắn');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Không copy được — vui lòng chọn text và copy thủ công');
    }
  };

  if (result) {
    const zaloUrl = `https://zalo.me/?text=${encodeURIComponent(result.smsTemplate)}`;
    return (
      <Card variant="elevated">
        <CardHeader>
          <CardHeaderText>
            <CardTitle>✅ Đã tạo {result.name}</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-success-soft text-success-strong text-sm p-3 leading-relaxed">
            <div>
              <strong>{result.name}</strong> đã được thêm vào công ty{' '}
              <strong>{result.entName}</strong> với vai trò{' '}
              <strong>{result.role}</strong>.
            </div>
            <div className="mt-1 text-xs">
              SĐT đăng nhập: <code className="font-mono">{result.phone}</code>{' '}
              · Mã công ty: <code className="font-mono">{result.entCode}</code>
            </div>
          </div>

          <div>
            <Label>Tin nhắn gửi cho {result.name}</Label>
            <textarea
              readOnly
              value={result.smsTemplate}
              rows={6}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 p-3 text-sm font-mono whitespace-pre-wrap"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={handleCopy} variant="accent" size="md">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Đã copy' : 'Copy nội dung'}
              </Button>
              <Button asChild variant="secondary" size="md">
                <a href={zaloUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4" />
                  Mở Zalo để gửi
                </a>
              </Button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="ghost" onClick={() => setResult(null)}>
              Thêm người khác
            </Button>
            <Button variant="secondary" onClick={() => router.push('/users')}>
              Về danh sách
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
          <CardTitle>Thông tin thành viên</CardTitle>
        </CardHeaderText>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">
              Họ và tên <span className="text-danger">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn Bình"
              maxLength={50}
            />
          </div>

          {/* ── PHONE (CRITICAL) ──
           * Đây là login key duy nhất của user. Sai = user không bao giờ login được.
           * Banner danger-styled prominent để admin chú ý gấp đôi khi điền. */}
          <div className="rounded-md border-2 border-danger/40 bg-danger-soft/30 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <KeyRound className="h-5 w-5 text-danger shrink-0 mt-0.5" aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-danger">
                  SĐT đăng nhập (rất quan trọng)
                </div>
                <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                  Đây là <strong>thông tin DUY NHẤT</strong> để user login app. Sai = user không vào được.
                  Hãy <strong>xác nhận lại</strong> với user trước khi tạo.
                </p>
              </div>
            </div>

            <div>
              <Label htmlFor="phone" className="text-xs">
                Số điện thoại <span className="text-danger">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0904567890 hoặc +84 904567890"
                inputMode="tel"
                pattern="[+0-9\s\-]{9,15}"
                className={
                  'font-mono ' +
                  (phone && !isValidVnMobile(normalizePreview(phone))
                    ? 'border-danger focus-visible:border-danger'
                    : '')
                }
              />
              <div className="mt-1.5 text-xs flex items-center justify-between gap-2 flex-wrap">
                <span className="text-text-faint">
                  Hệ thống tự chuẩn hoá <code className="font-mono">+84</code> /
                  khoảng trắng → 10 chữ số.
                </span>
                {phone && (
                  <span
                    className={
                      'font-mono tabular ' +
                      (isValidVnMobile(normalizePreview(phone))
                        ? 'text-success font-semibold'
                        : 'text-danger')
                    }
                  >
                    {isValidVnMobile(normalizePreview(phone))
                      ? `→ ${normalizePreview(phone)} ✓`
                      : '✗ Không hợp lệ (10 chữ số bắt đầu 03/05/07/08/09)'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="role">
              Vai trò <span className="text-danger">*</span>
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
              <p className="mt-1 text-xs text-text-muted">
                Manager chỉ có thể tạo Driver hoặc Viewer.
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="department">Phòng ban (tùy chọn)</Label>
            <Input
              id="department"
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="VD: Vận hành"
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
              Hủy
            </Button>
            <Button type="submit" variant="accent" disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Tạo thành viên
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
