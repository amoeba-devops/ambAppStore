'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client/api';
import { VehicleForm } from '@/components/vehicles/VehicleForm';
import type { Driver } from '@repo/api-types';

export default function NewVehiclePage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    apiFetch<Driver[]>('/api/drivers?status=ACTIVE').then(setDrivers).catch(() => setDrivers([]));
  }, []);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">New vehicle</h1>
      <VehicleForm drivers={drivers} />
    </div>
  );
}
