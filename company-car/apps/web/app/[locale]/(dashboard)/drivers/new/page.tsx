'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { DriverForm } from '@/components/drivers/DriverForm';
import type { User } from '@repo/api-types';

export default function NewDriverPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    apiFetch<User[]>('/api/users').then(setUsers).catch(() => setUsers([]));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">New driver</h1>
      <DriverForm users={users} />
    </div>
  );
}
