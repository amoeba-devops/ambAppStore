export function Footer() {
  return (
    <footer className="border-t bg-gray-50 py-6">
      <div className="mx-auto max-w-6xl px-4 text-center text-sm text-gray-400">
        © {new Date().getFullYear()} Amoeba Company. All rights reserved.
      </div>
    </footer>
  );
}
