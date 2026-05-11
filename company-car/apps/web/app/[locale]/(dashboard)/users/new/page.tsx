import { UserForm } from '@/components/users/UserForm';

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">New user</h1>
      <UserForm />
    </div>
  );
}
