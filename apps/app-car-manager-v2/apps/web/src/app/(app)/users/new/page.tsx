import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { PageHeader } from '@/components/layout/page-header';
import { AddMemberForm } from './_components/add-member-form';

/**
 * D-017 — Admin/Manager tạo member (driver/viewer) bằng phone-only.
 * Sau khi tạo, hiện modal SMS template để admin copy gửi qua Zalo.
 *
 * Access:
 *   - ADMIN (local): tạo MASTER/MANAGER/MEMBER/VIEWER
 *   - MANAGER (local): chỉ tạo MEMBER (driver) / VIEWER — UI filter trong AddMemberForm
 *   - DRIVER: redirect /today
 *
 * AMA-side guard: `OwnEntityManagerGuard` (mới) cho phép MASTER/ADMIN/MANAGER
 * eur_role. Service layer enforce MANAGER chỉ assign MEMBER/VIEWER.
 */
export default async function NewUserPage() {
  const actor = await getCurrentUser();
  if (actor.role === 'DRIVER') redirect('/today');

  return (
    <>
      <PageHeader
        title="Thêm thành viên mới"
        subtitle="Tạo tài khoản đăng nhập bằng số điện thoại (không cần mật khẩu)"
        breadcrumbs={[
          { label: 'Người dùng', href: '/users' },
          { label: 'Thêm mới' },
        ]}
      />
      <div className="mt-6 max-w-2xl">
        <AddMemberForm actorRole={actor.role} />
      </div>
    </>
  );
}
