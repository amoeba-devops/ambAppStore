'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { UserForm } from '@/components/users/UserForm';
import type { User } from '@repo/api-types';

export default function EditUserPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    apiFetch<User>(`/api/users/${id}`).then(setUser);
  }, [id]);

  if (!user) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Edit {user.fullName}</h1>
      <UserForm initial={user} isEdit userId={id} />
    </div>
  );
}
