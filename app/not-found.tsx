import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col items-center justify-center p-6 text-center font-sans">
      <div className="max-w-md space-y-4">
        <span className="text-4xl">📜</span>
        <h1 className="text-2xl sm:text-3xl font-serif text-amber-100 font-medium">
          Story Not Found
        </h1>
        <p className="text-sm text-slate-400 font-serif leading-relaxed">
          The story or page you are looking for does not exist or may have been moved.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-xs transition-colors inline-block"
          >
            Return to Story Library
          </Link>
        </div>
      </div>
    </div>
  );
}

