export default function Loading() {
  return (
    <div className="mx-auto flex max-w-6xl items-center justify-center px-4 py-24" role="status" aria-label="Loading">
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-red-200 border-t-red-600" />
    </div>
  );
}
