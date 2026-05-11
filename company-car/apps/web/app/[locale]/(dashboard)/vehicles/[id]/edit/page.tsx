'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/client/api';
import { VehicleForm } from '@/components/vehicles/VehicleForm';
import type { Driver, Vehicle } from '@repo/api-types';

export default function EditVehiclePage() {
  const { id } = useParams<{ id: string }>();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    Promise.all([
      apiFetch<Vehicle>(`/api/vehicles/${id}`),
      apiFetch<Driver[]>('/api/drivers?status=ACTIVE'),
    ]).then(([v, d]) => {
      setVehicle(v);
      setDrivers(d);
    });
  }, [id]);

  if (!vehicle) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Edit {vehicle.licensePlate}</h1>
      <VehicleForm initial={vehicle} drivers={drivers} isEdit vehicleId={id} />
    </div>
  );
}
