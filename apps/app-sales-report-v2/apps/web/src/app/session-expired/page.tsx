export default function SessionExpiredPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-lg font-semibold">Session expired</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Please reopen this app from AMA Management to continue.
        </p>
      </div>
    </div>
  );
}
