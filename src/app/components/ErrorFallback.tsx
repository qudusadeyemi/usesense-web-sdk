export default function ErrorFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Page Not Found</h1>
        <p className="text-slate-600 mb-4">The page you're looking for doesn't exist.</p>
        <a href="/" className="text-blue-600 hover:underline">Go to Demo Home</a>
      </div>
    </div>
  );
}
