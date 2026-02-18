export default function Loading() {
    return (
        <main className="dashboard-page max-w-[1680px] mx-auto p-5">
            {/* Site Nav Skeleton */}
            <div className="sticky top-[10px] z-[120] mb-4 flex items-center justify-between gap-3 rounded-[22px] border border-[#e6ddd2] bg-white/80 p-[9px_14px] backdrop-blur-sm">
                <div className="flex flex-1 items-center gap-3 min-w-0">
                    <div className="h-[84px] w-[84px] animate-pulse rounded-full bg-[#e6ddd2]/50" />
                    <div className="h-10 w-32 animate-pulse rounded-full bg-[#f8f1e3]" />
                    <div className="h-10 w-32 animate-pulse rounded-full bg-[#f8f1e3]" />
                </div>
                <div className="mx-auto flex-1 text-center">
                    <div className="mx-auto h-8 w-64 animate-pulse rounded-lg bg-[#665745]/10" />
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-10 w-10 animate-pulse rounded-full bg-[#f8f1e3]" />
                </div>
            </div>

            {/* Toolbar Skeleton */}
            <div className="mb-6 flex justify-center">
                <div className="flex h-[72px] w-full max-w-4xl items-center gap-4 rounded-3xl border border-[#e2d4be] bg-[#fffdf7] p-2 px-6 shadow-[0_14px_30px_rgba(70,54,26,0.06)]">
                    <div className="h-12 w-48 animate-pulse rounded-xl bg-[#f0e6d2]" />
                    <div className="h-12 w-48 animate-pulse rounded-xl bg-[#f0e6d2]" />
                    <div className="h-12 w-32 animate-pulse rounded-xl bg-[#f0e6d2]" />
                </div>
            </div>

            {/* Grid Skeleton */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(340px,1fr))] gap-5 items-start">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div
                        key={i}
                        className="flex flex-col gap-4 rounded-3xl border border-[#e7ddd2] bg-white p-5 shadow-sm"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="h-12 w-12 animate-pulse rounded-full bg-[#f2ede4]" />
                                <div className="h-6 w-32 animate-pulse rounded-lg bg-[#f2ede4]" />
                            </div>
                            <div className="h-8 w-8 animate-pulse rounded-full bg-[#f2ede4]" />
                        </div>

                        <div className="space-y-3">
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div key={j} className="flex items-center justify-between rounded-xl bg-[#fcf9f4] p-3">
                                    <div className="h-5 w-24 animate-pulse rounded bg-[#e8decb]/40" />
                                    <div className="flex gap-2">
                                        <div className="h-6 w-6 animate-pulse rounded-full bg-[#e8decb]/40" />
                                        <div className="h-6 w-6 animate-pulse rounded-full bg-[#e8decb]/40" />
                                        <div className="h-6 w-6 animate-pulse rounded-full bg-[#e8decb]/40" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </main>
    );
}
