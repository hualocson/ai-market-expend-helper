const AppLoading = () => {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="mx-auto flex min-h-svh max-w-lg flex-col gap-6 px-4 pt-6 pb-16 sm:px-6"
    >
      <section className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
            <div className="h-9 w-52 animate-pulse rounded-full bg-white/10 sm:w-60" />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="h-4 w-40 animate-pulse rounded-full bg-white/10" />
            <div className="h-9 w-28 animate-pulse rounded-full bg-white/10" />
          </div>
        </div>

        <div className="rounded-[28px] bg-white/5 p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
              <div className="h-4 w-20 animate-pulse rounded-full bg-white/5" />
            </div>
            <div className="h-40 animate-pulse rounded-2xl bg-white/5" />
          </div>
        </div>
      </section>

      <section className="flex w-full grow flex-col gap-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-2">
            <div className="h-5 w-32 animate-pulse rounded-full bg-white/10" />
            <div className="h-4 w-48 animate-pulse rounded-full bg-white/5" />
          </div>
          <div className="h-4 w-12 animate-pulse rounded-full bg-white/10" />
        </div>

        <div className="bg-muted/30 flex grow flex-col gap-4 overflow-hidden rounded-3xl px-4 py-4 sm:px-6">
          {Array.from({ length: 2 }, (_, index) => (
            <div key={index} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-36 animate-pulse rounded-full bg-white/10" />
                <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
              </div>
              <div className="flex flex-col gap-3">
                {Array.from({ length: 2 }, (_, item) => (
                  <div
                    key={`${index}-${item}`}
                    className="h-12 animate-pulse rounded-2xl bg-white/5"
                  />
                ))}
              </div>
            </div>
          ))}

          <div className="mt-auto h-10 animate-pulse rounded-full bg-white/10" />
        </div>
      </section>
    </div>
  );
};

export default AppLoading;
