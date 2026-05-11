'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { DriverForm } from '@/components/drivers/DriverForm';
import type { Driver, User } from '@repo/api-types';

export default function EditDriverPage() {
  const { id } = useParams<{ id: string }>();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<Driver>(`/api/drivers/${id}`),
      apiFetch<User[]>('/api/users'),
    ]).then(([d, u]) => {
      setDriver(d);
      setUsers(u);
    });
  }, [id]);

  if (!driver) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Edit {driver.fullName}</h1>
      <DriverForm initial={driver} users={users} isEdit driverId={id} />
    </div>
  );
}
