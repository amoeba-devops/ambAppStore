'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { KeyRound, Loader2, Save, UserPlus } from 'lucide-react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
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
  Textarea,
  toast,
} from '@car-v2/ui';
import type { CarDriverLicenseClass } from '@car-v2/db/schema';
import { formatActionError } from '@/lib/format-action-error';
import { useTranslations } from 'next-intl';
import { createDriverWithUserAction } from '@/server/actions/drivers/driver.actions';

const LICENSE_CLASSES: CarDriverLicenseClass[] = ['A2', 'B1', 'B2', 'C', 'D', 'E', 'F'];

function normalizePreview(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('84') && digits.length === 11) digits = '0' + digits.slice(2);
  return digits;
}
function isValidVnMobile(phone: string): boolean {
  return /^0[35789]\d{8}$/.test(phone);
}

/**
 * Tạo tài xế trong 1 form duy nhất — auto-create AMA user backing driver.
 *
 * Khác với DriverForm (existing):
 *   - KHÔNG yêu cầu admin tạo user trước qua /users/new
 *   - Form chứa cả user info (tên, SĐT, dept) + driver info (license)
 *   - Server action tạo AMA user → car_users → car_drivers trong 1 transaction
 *   - Phone uniqueness check theo ent_id (do AMA enforce)
 *
 * Khi nào dùng:
 *   - Admin có driver mới hoàn toàn, chưa từng login app
 *   - Hoặc đơn giản muốn 1-step thay vì 2-step (users/new → drivers/new)
 */
export function InlineDriverForm() {
  const router = useRouter();
  const tA = useTranslations('actions');
  const tErr = useTranslations();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseClass, setLicenseClass] = useState<CarDriverLicenseClass>('B2');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [notes, setNotes] = useState('');

  const normalizedPhone = normalizePreview(phone);
  const phoneValid = !phone || isValidVnMobile(normalizedPhone);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      toast.error('Tên tài xế tối thiểu 2 ký tự');
      return;
    }
    if (!phoneValid) {
      toast.error('SĐT không hợp lệ', {
        description: 'Yêu cầu 10 chữ số bắt đầu 03/05/07/08/09.',
      });
      return;
    }
    if (!licenseNumber.trim() || !licenseExpiry) {
      toast.error('Vui lòng nhập đầy đủ số bằng lái và ngày hết hạn');
      return;
    }
    startTransition(async () => {
      const res = await createDriverWithUserAction({
        name: name.trim(),
        phone: phone.trim(),
        department: department.trim() || undefined,
        license_number: licenseNumber.trim(),
        license_class: licenseClass,
        license_expiry: licenseExpiry,
        emergency_contact: emergencyContact.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (!res.success) {
        toast.error('Không tạo được tài xế', {
          description: formatActionError(res.error, tErr),
        });
        return;
      }
      toast.success(`Đã tạo tài xế ${name}`, {
        description: `Tài xế login với SĐT ${normalizedPhone}`,
      });
      router.push(`/drivers/${res.data.drvId}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-[720px] mx-auto space-y-5">
      {/* User info section */}
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Thông tin tài xế
            </CardTitle>
            <CardDescription>
              Hệ thống sẽ tự tạo tài khoản đăng nhập với SĐT bên dưới — admin không cần
              vào trang Người dùng riêng.
            </CardDescription>
          </CardHeaderText>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label required>Họ và tên</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nguyễn Văn Tài"
              maxLength={50}
              required
            />
          </div>

          {/* CRITICAL phone field — same emphasis pattern as AddMemberForm. */}
          <div className="rounded-md border-2 border-danger/40 bg-danger-soft/30 p-3 space-y-3">
            <div className="flex items-start gap-2">
              <KeyRound className="h-5 w-5 text-danger shrink-0 mt-0.5" aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-danger">
                  SĐT đăng nhập (rất quan trọng)
                </div>
                <p className="text-xs text-text-muted leading-relaxed mt-0.5">
                  Đây là <strong>SĐT DUY NHẤT</strong> để tài xế login app. Sai = tài xế
                  không vào được app. Hệ thống check trùng SĐT trong công ty.
                </p>
              </div>
            </div>
            <div>
              <Label required>Số điện thoại</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0904567890 hoặc +84 904567890"
                type="tel"
                inputMode="tel"
                pattern="[+0-9\s\-]{9,15}"
                required
                className={
                  'font-mono ' +
                  (phone && !phoneValid ? 'border-danger focus-visible:border-danger' : '')
                }
              />
              <div className="mt-1.5 text-xs flex items-center justify-between gap-2 flex-wrap">
                <span className="text-text-faint">
                  Tự chuẩn hoá <code className="font-mono">+84</code> / khoảng trắng → 10 chữ số.
                </span>
                {phone && (
                  <span
                    className={
                      'font-mono tabular ' +
                      (phoneValid ? 'text-success font-semibold' : 'text-danger')
                    }
                  >
                    {phoneValid
                      ? `→ ${normalizedPhone} ✓`
                      : '✗ Không hợp lệ'}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div>
            <Label>Phòng ban (tùy chọn)</Label>
            <Input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="VD: Đội xe HCMC"
              maxLength={30}
            />
          </div>
        </CardContent>
      </Card>

      {/* License section */}
      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Bằng lái</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label required>Số bằng lái</Label>
              <Input
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="VD: B2-1234567"
                maxLength={50}
                required
                className="font-mono"
              />
            </div>
            <div>
              <Label required>Hạng</Label>
              <Select
                value={licenseClass}
                onValueChange={(v) => setLicenseClass(v as CarDriverLicenseClass)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LICENSE_CLASSES.map((c) => (
                    <SelectItem key={c} value={c}>Hạng {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label required>Ngày hết hạn</Label>
              <Input
                type="date"
                value={licenseExpiry}
                onChange={(e) => setLicenseExpiry(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label>Liên hệ khẩn cấp (tùy chọn)</Label>
              <Input
                value={emergencyContact}
                onChange={(e) => setEmergencyContact(e.target.value)}
                placeholder="VD: Nguyễn Văn A — 0901234567"
                maxLength={100}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardHeaderText>
            <CardTitle>Ghi chú</CardTitle>
          </CardHeaderText>
        </CardHeader>
        <CardContent>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ghi chú nội bộ..."
            rows={3}
            maxLength={2000}
          />
        </CardContent>
      </Card>

      <div className="md:flex md:justify-end md:gap-2 md:pt-2 sticky bottom-0 -mx-4 px-4 py-3 bg-bg/95 backdrop-blur border-t border-border flex gap-2 md:border-t-0 md:bg-transparent md:px-0 md:py-0 md:static md:mx-0">
        <Button type="button" variant="secondary" size="lg" className="flex-1 md:flex-initial" asChild>
          <Link href="/drivers">{tA('cancel')}</Link>
        </Button>
        <Button
          type="submit"
          variant="accent"
          size="lg"
          className="flex-1 md:flex-initial"
          disabled={pending || (Boolean(phone) && !phoneValid)}
          iconLeft={pending ? <Loader2 className="animate-spin" /> : <Save />}
        >
          {pending ? 'Đang tạo…' : 'Tạo tài xế'}
        </Button>
      </div>
    </form>
  );
}
