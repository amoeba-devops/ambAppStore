'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, KeyRound, Loader2, Save } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardHeaderText,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import type { AmaMember } from '@/server/services/ama/list-entity-members';

interface EditMemberFormProps {
  member: AmaMember;
}

const ROLES = ['MASTER', 'MANAGER', 'MEMBER', 'VIEWER'] as const;
const STATUSES = ['ACTIVE', 'INACTIVE', 'SUSPENDED'] as const;

const ROLE_LABELS: Record<string, string> = {
  MASTER: 'Master (Quản trị cấp cao)',
  MANAGER: 'Manager (Quản lý)',
  MEMBER: 'Driver (Tài xế)',
  VIEWER: 'Viewer (Chỉ xem)',
};

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Hoạt động',
  INACTIVE: 'Tạm khoá',
  SUSPENDED: 'Đình chỉ',
};

/** Client-side mirror của AMA normalizeVnPhone — chỉ để preview, server vẫn validate lại. */
function normalizePreview(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('84') && digits.length === 11) digits = '0' + digits.slice(2);
  return digits;
}

/** Hợp lệ canonical VN mobile: 10 digits bắt đầu 03/05/07/08/09. */
function isValidVnMobile(phone: string): boolean {
  return /^0[35789]\d{8}$/.test(phone);
}

export function EditMemberForm({ member }: EditMemberFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // AMA returns usr_role (user-level); for role editing we map closest local enum.
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
  const [confirmOpen, setConfirmOpen] = useState(false);

  const originalPhone = member.phone ?? '';
  const normalizedPhone = normalizePreview(phone);
  const phoneChanged = normalizedPhone !== originalPhone;
  const phoneValid = !phone || isValidVnMobile(normalizedPhone);

  const doSubmit = () => {
    startTransition(async () => {
      const res = await updateMemberAction({
        userId: member.userId,
        role,
        status,
        department: department.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        /* Chỉ gửi phone khi user actually changed — tránh trigger phone-change
         * audit log không cần thiết. AMA tự normalize + validate ngày-side. */
        phone: phoneChanged && phone.trim() ? phone.trim() : undefined,
      });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      toast.success(`Đã cập nhật ${member.name ?? member.email}`);
      setConfirmOpen(false);
      router.push('/users');
      router.refresh();
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone && !phoneValid) {
      toast.error('SĐT không đúng format VN (10 chữ số bắt đầu 03/05/07/08/09)');
      return;
    }
    // CRITICAL: phone change → confirmation dialog. User phải đọc warning trước khi commit.
    if (phoneChanged) {
      setConfirmOpen(true);
      return;
    }
    doSubmit();
  };

  return (
    <>
      <Card variant="elevated">
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Thông tin thành viên</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
            {/* Read-only info — phone giờ editable, bỏ note SĐT chỉ ở AMA */}
            <div className="rounded-md bg-surface-2 p-3 space-y-2 text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2">
                <span className="text-text-muted text-xs sm:text-sm">Tên</span>
                <span className="font-medium text-text break-words">{member.name ?? '—'}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5 sm:gap-2">
                <span className="text-text-muted text-xs sm:text-sm">Email/ID</span>
                <span className="font-mono text-xs text-text break-all">{member.email}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1 sm:gap-2">
                <span className="text-text-muted text-xs sm:text-sm">Level</span>
                <Badge tone="neutral" size="sm">{member.levelCode}</Badge>
              </div>
            </div>

            {/* ── PHONE (CRITICAL) ──
             * Đổi SĐT = đổi login key. Driver dùng SĐT cũ sẽ không vào được app.
             * Banner danger-soft phía trên, normalize preview ngay dưới input. */}
            <div className="rounded-md border-2 border-danger/40 bg-danger-soft/30 p-3 space-y-3">
              <div className="flex items-start gap-2">
                <KeyRound className="h-5 w-5 text-danger shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-danger">
                    SĐT đăng nhập
                  </div>
                  <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                    Đây là <strong>SĐT user dùng để login app</strong>. Đổi sai số = user
                    không vào được app. Hãy chắc chắn báo cho user trước khi đổi.
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
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="VD: 0904567890"
                  pattern="[+0-9\s\-]{9,}"
                  className={
                    'font-mono ' +
                    (phone && !phoneValid ? 'border-danger focus-visible:border-danger' : '')
                  }
                />
                <div className="mt-1.5 text-xs flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-text-faint">
                    Hệ thống tự chuẩn hoá <code className="font-mono">+84</code> /
                    khoảng trắng.
                  </span>
                  {phone && (
                    <span
                      className={
                        'font-mono tabular ' +
                        (phoneValid ? 'text-success font-semibold' : 'text-danger')
                      }
                    >
                      {phoneValid
                        ? `→ ${normalizedPhone}${phoneChanged ? ' (THAY ĐỔI)' : ''}`
                        : '✗ Không hợp lệ'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="role">
                Vai trò (AMA) <span className="text-danger">*</span>
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
              <p className="mt-1 text-xs text-text-muted">
                Vai trò AMA quyết định quyền trong v2. MEMBER → DRIVER, MANAGER → MANAGER, MASTER → ADMIN.
              </p>
            </div>

            <div>
              <Label htmlFor="status">
                Trạng thái <span className="text-danger">*</span>
              </Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-text-muted">
                INACTIVE/SUSPENDED → user không login được nữa.
              </p>
            </div>

            <div>
              <Label htmlFor="department">Phòng ban</Label>
              <Input
                id="department"
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="VD: Vận hành"
                maxLength={30}
              />
            </div>

            <div>
              <Label htmlFor="jobTitle">Chức danh</Label>
              <Input
                id="jobTitle"
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                placeholder="VD: Trưởng phòng"
                maxLength={100}
              />
            </div>

            {/* Action buttons */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4 border-t border-border">
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => router.push('/users')}
                disabled={pending}
                className="w-full sm:w-auto"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                variant="accent"
                size="lg"
                disabled={pending || Boolean(phone && !phoneValid)}
                className="w-full sm:w-auto"
              >
                {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Lưu thay đổi
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Confirmation dialog — bắt buộc khi đổi SĐT login. */}
      <Dialog open={confirmOpen} onOpenChange={(o) => !pending && setConfirmOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-danger">
              <AlertTriangle className="h-5 w-5" />
              Xác nhận đổi SĐT đăng nhập
            </DialogTitle>
            <DialogDescription>
              Hành động này sẽ ảnh hưởng đến khả năng đăng nhập của user.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-surface-2 p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">User</span>
                <span className="font-medium text-text">{member.name ?? member.email}</span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-text-muted">SĐT cũ</span>
                <span className="font-mono text-text-muted line-through tabular">
                  {originalPhone || '(chưa có)'}
                </span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-text-muted">SĐT mới</span>
                <span className="font-mono tabular font-bold text-danger">
                  {normalizedPhone}
                </span>
              </div>
            </div>
            <div className="rounded-md bg-warning-soft/40 border border-warning/30 p-3 text-xs text-text leading-relaxed">
              <strong className="text-warning-strong">Sau khi đổi:</strong>
              <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                <li>User <strong>KHÔNG</strong> login được bằng SĐT cũ nữa</li>
                <li>User phải dùng SĐT mới <code className="font-mono">{normalizedPhone}</code> để login</li>
                <li>Token hiện tại của user vẫn dùng được trong tối đa 1h tiếp theo</li>
                <li>Hãy thông báo cho user trước khi xác nhận</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={doSubmit}
              disabled={pending}
              iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}
            >
              {pending ? 'Đang lưu…' : 'Xác nhận đổi SĐT'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
