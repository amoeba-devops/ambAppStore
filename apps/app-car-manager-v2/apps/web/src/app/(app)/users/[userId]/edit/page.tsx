import { redirect, notFound } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-current-user';
import { PageHeader } from '@/components/layout/page-header';
import { listEntityMembersFromAma } from '@/server/services/ama/list-entity-members';
import { EditMemberForm } from './_components/edit-member-form';

/**
 * Admin edit existing member — fetch real data từ AMA → render form → save qua AMA.
 *
 * Access: ADMIN only (AMA OwnEntityGuard yêu cầu MASTER/ADMIN; v2 ADMIN map từ
 * AMA OWNER/MASTER/ADMIN nên đủ quyền).
 */
export default async function EditUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const actor = await getCurrentUser();
  if (actor.role !== 'ADMIN') {
    redirect(actor.role === 'DRIVER' ? '/today' : '/users');
  }

  const { userId } = await params;

  // Lấy current data từ AMA member list (đơn giản hơn build endpoint riêng cho GET 1 user)
  const members = await listEntityMembersFromAma(actor.entId);
  if (members === null) {
    redirect('/users');
  }
  const member = members.find((m) => m.userId === userId);
  if (!member) {
    notFound();
  }

  return (
    <>
      <PageHeader
        title="Chỉnh sửa thành viên"
        subtitle={`${member.name ?? member.email}`}
        breadcrumbs={[
          { label: 'Người dùng', href: '/users' },
          { label: 'Chỉnh sửa' },
        ]}
      />
      <div className="px-4 md:px-7 py-4 md:py-6 max-w-2xl mx-auto md:mx-0 w-full">
        <EditMemberForm member={member} />
      </div>
    </>
  );
}
