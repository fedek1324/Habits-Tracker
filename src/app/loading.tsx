export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-2xl mx-auto bg-white min-h-screen shadow-sm">
        <main className="p-4 pb-20">
          {/* Title skeleton */}
          <div className="h-7 bg-gray-200 rounded-lg w-3/4 mb-6 animate-pulse" />

          {/* Synced bar skeleton */}
          <div className="mb-4 bg-gray-100 rounded-2xl px-5 py-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-300 rounded-full" />
                <div className="h-4 bg-gray-200 rounded w-14" />
              </div>
              <div className="h-3 bg-gray-200 rounded w-16" />
            </div>
          </div>

          {/* Habit card skeletons */}
          <div className="mb-4 w-full space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl p-4 w-full flex items-center justify-between animate-pulse"
                style={{
                  backgroundColor: ["hsl(210,80%,94%)", "hsl(150,80%,94%)", "hsl(30,80%,94%)"][i - 1],
                  opacity: 1 - i * 0.15,
                }}
              >
                <div className="flex-1">
                  <div className="h-5 bg-white/50 rounded w-28 mb-2" />
                  <div className="h-4 bg-white/50 rounded w-12" />
                </div>
                <div className="flex space-x-2">
                  <div className="w-10 h-10 bg-white/40 rounded-full" />
                  <div className="w-10 h-10 bg-white/40 rounded-full" />
                  <div className="w-10 h-10 bg-white/40 rounded-full" />
                </div>
              </div>
            ))}
          </div>

          {/* Add buttons skeleton */}
          <div className="space-y-3 mt-6">
            <div className="h-12 bg-gray-100 rounded-2xl animate-pulse" />
            <div className="h-12 bg-gray-100 rounded-2xl animate-pulse" />
          </div>
        </main>

        {/* Bottom navigation skeleton (static, no pulse) */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
          <div className="max-w-2xl mx-auto">
            <div className="flex">
              <div className="flex-1 flex flex-col items-center justify-center py-3 px-4">
                <div className="w-6 h-6 bg-gray-200 rounded mb-1" />
                <div className="w-10 h-3 bg-gray-200 rounded" />
              </div>
              <div className="flex-1 flex flex-col items-center justify-center py-3 px-4">
                <div className="w-6 h-6 bg-gray-200 rounded mb-1" />
                <div className="w-10 h-3 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
        </nav>
      </div>
    </div>
  );
}
