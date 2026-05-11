import { db } from '@/lib/db/client';
import { notifications } from '@/lib/db/schema';

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
};

export async function notifyUser(input: NotifyInput): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    payload: input.payload ?? {},
  });
  // TODO: dispatch web push + Expo push when configured (Phase 5)
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await db.insert(notifications).values(
    inputs.map((i) => ({
      userId: i.userId,
      type: i.type,
      title: i.title,
      body: i.body,
      payload: i.payload ?? {},
    })),
  );
}
