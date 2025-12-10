export function SkeletonLoader() {
  return (
    <div>
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4 bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm h-10">
        <div className="flex-1 h-5 mx-4 rounded skeleton-shimmer"></div>
        <div className="w-15 h-4 mx-3 rounded skeleton-shimmer"></div>
        <div className="w-20 h-4 mx-4 rounded skeleton-shimmer"></div>
      </div>

      {/* First stackbar skeleton */}
      <div className="flex w-full h-16 bg-white rounded-xl overflow-hidden shadow-sm mb-5">
        <div
          className="h-full border-r border-white/30 skeleton-shimmer"
          style={{ width: '60%' }}
        ></div>
        <div
          className="h-full border-r border-white/30 skeleton-shimmer"
          style={{ width: '25%' }}
        ></div>
        <div className="h-full skeleton-shimmer" style={{ width: '15%' }}></div>
      </div>

      {/* Second stackbar skeleton */}
      <div className="flex w-full h-16 bg-white rounded-xl overflow-hidden shadow-sm mb-5">
        <div
          className="h-full border-r border-white/30 skeleton-shimmer"
          style={{ width: '45%' }}
        ></div>
        <div
          className="h-full border-r border-white/30 skeleton-shimmer"
          style={{ width: '35%' }}
        ></div>
        <div className="h-full skeleton-shimmer" style={{ width: '20%' }}></div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200px 0;
          }
          100% {
            background-position: calc(200px + 100%) 0;
          }
        }

        .skeleton-shimmer {
          background: linear-gradient(
            90deg,
            #f0f0f0 25%,
            #e0e0e0 50%,
            #f0f0f0 75%
          );
          background-size: 200px 100%;
          animation: shimmer 1.5s infinite;
        }
      `}</style>
    </div>
  );
}
