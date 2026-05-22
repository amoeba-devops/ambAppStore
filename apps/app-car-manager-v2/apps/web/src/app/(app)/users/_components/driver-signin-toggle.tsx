'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Lock, Unlock } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from '@car-v2/ui';
import { updateMemberAction } from '@/server/actions/users/update-member.action';

interface DriverSigninToggleProps {
  amaUserId: string;
  displayName: string;
  /** Trạng thái hiện tại từ AMA: ACTIVE / INACTIVE / SUSPENDED. */
  currentStatus: string;
  /** Compact mode — chỉ icon, kích cỡ nhỏ (dùng trong table dense). Default false. */
  compact?: boolean;
}

/**
 * Quick toggle revoke/restore signin cho driver — không phải vào form edit dài.
 *
 * UX:
 *   - status ACTIVE      → button "Khoá" (danger) → confirm → set INACTIVE
 *   - status INACTIVE/SUSPENDED → button "Mở khoá" (success) → confirm → set ACTIVE
 *
 * Lý do bắt buộc confirm:
 *   - Action có side effect lên user khác (driver mất khả năng login)
 *   - Token hiện tại của driver vẫn dùng được tối đa 1h sau revoke (JWT TTL)
 *   - Admin cần được nhắc lại trước khi commit
 *
 * Backend: dùng chung `updateMemberAction` (đã verify ADMIN role + ent_id scope).
 * Không cần action riêng — status update path đã có sẵn validation đầy đủ.
 */
export function DriverSigninToggle({
  amaUserId,
  displayName,
  currentStatus,
  compact = false,
}: DriverSigninToggleProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const isCurrentlyActive = currentStatus === 'ACTIVE';
  const nextStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
  const verb = isCurrentlyActive ? 'Khoá đăng nhập' : 'Mở khoá đăng nhập';

  const doToggle = () => {
    startTransition(async () => {
      const res = await updateMemberAction({
        userId: amaUserId,
        status: nextStatus,
      });
      if (!res.success) {
        toast.error(res.error.message);
        return;
      }
      toast.success(
        isCurrentlyActive
          ? `Đã khoá đăng nhập ${displayName}`
          : `Đã mở khoá đăng nhập ${displayName}`,
      );
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      {compact ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen(true)}
          aria-label={`${verb} ${displayName}`}
          title={verb}
          className={
            'text-xs ' +
            (isCurrentlyActive
              ? 'text-danger hover:text-danger hover:bg-danger-soft'
              : 'text-success hover:text-success hover:bg-success-soft')
          }
          iconLeft={isCurrentlyActive ? <Lock /> : <Unlock />}
        >
          {isCurrentlyActive ? 'Khoá' : 'Mở khoá'}
        </Button>
      ) : (
        <Button
          type="button"
          variant={isCurrentlyActive ? 'ghost' : 'accent'}
          size="sm"
          onClick={() => setOpen(true)}
          className={
            isCurrentlyActive
              ? 'text-danger hover:text-danger hover:bg-danger-soft'
              : ''
          }
          iconLeft={isCurrentlyActive ? <Lock /> : <Unlock />}
        >
          {verb}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${isCurrentlyActive ? 'text-danger' : 'text-success'}`}>
              {isCurrentlyActive ? <AlertTriangle className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              Xác nhận {isCurrentlyActive ? 'khoá' : 'mở khoá'} đăng nhập
            </DialogTitle>
            <DialogDescription>
              {isCurrentlyActive
                ? 'Tài xế sẽ không login vào app được sau khi khoá.'
                : 'Tài xế sẽ login được trở lại sau khi mở khoá.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-surface-2 p-3 space-y-2">
              <div className="flex justify-between gap-2">
                <span className="text-text-muted">Tài xế</span>
                <span className="font-medium text-text">{displayName}</span>
              </div>
              <div className="flex justify-between gap-2 items-center">
                <span className="text-text-muted">Trạng thái</span>
                <span className="font-mono text-xs tabular">
                  <span className={isCurrentlyActive ? 'text-success line-through' : 'text-danger line-through'}>
                    {currentStatus}
                  </span>
                  <span className="mx-1.5 text-text-faint">→</span>
                  <span className={isCurrentlyActive ? 'text-danger font-bold' : 'text-success font-bold'}>
                    {nextStatus}
                  </span>
                </span>
              </div>
            </div>

            {isCurrentlyActive ? (
              <div className="rounded-md bg-warning-soft/40 border border-warning/30 p-3 text-xs text-text leading-relaxed">
                <strong className="text-warning-strong">Sau khi khoá:</strong>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                  <li>Tài xế <strong>KHÔNG</strong> login mới được</li>
                  <li>Token hiện tại còn dùng được tối đa <strong>1 giờ</strong> tiếp theo</li>
                  <li>Tài xế vẫn xuất hiện ở tab <em>Tạm khoá</em> — mở khoá bất kỳ lúc nào</li>
                </ul>
              </div>
            ) : (
              <div className="rounded-md bg-success-soft/40 border border-success/30 p-3 text-xs text-text leading-relaxed">
                <strong className="text-success">Sau khi mở khoá:</strong>
                <ul className="mt-1.5 list-disc list-inside space-y-0.5">
                  <li>Tài xế login lại được bằng SĐT đã đăng ký</li>
                  <li>Mọi cài đặt khác (role, phòng ban, license) giữ nguyên</li>
                </ul>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant={isCurrentlyActive ? 'danger' : 'accent'}
              onClick={doToggle}
              disabled={pending}
              iconLeft={
                pending ? <Loader2 className="animate-spin" /> :
                isCurrentlyActive ? <Lock /> : <Unlock />
              }
            >
              {pending ? 'Đang xử lý…' : verb}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
