import CompactBottomNavPreview from "@/components/CompactBottomNavPreview";

const previewRows = [
  "Build new payment reconciliation workflow",
  "Update checkout logic to dynamically prefer recent budgets",
  'New "Contact Us" Button in Blue',
  "Update the Read Me",
  "blue contact us button",
  "Remove ! in Read.Me",
  "Issue with automatic case status update",
  "Weekly grocery budget review",
];

const BottomNavPreviewPage = () => {
  return (
    <main className="bg-background text-foreground relative mx-auto min-h-svh w-full max-w-[430px] overflow-hidden">
      <section className="px-5 pt-8 pb-36">
        <p className="text-muted-foreground text-xs font-semibold">
          Bottom nav test
        </p>
        <h1 className="mt-2 max-w-[280px] text-[28px] leading-[1.05] font-semibold tracking-normal">
          Compact grouped navigation
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-2.5">
          <div className="bg-surface-2 h-24 rounded-[18px] border border-white/7" />
          <div className="bg-surface-2 h-24 rounded-[18px] border border-white/7" />
        </div>

        <div className="mt-5 grid gap-0">
          {previewRows.map((row, index) => (
            <div
              key={row}
              className="grid min-h-[76px] grid-cols-[34px_minmax(0,1fr)_34px] items-center border-b border-white/5"
            >
              <span className="border-warning relative size-5 rounded-full border-[3px]">
                <span className="bg-warning absolute top-0.5 left-1.5 h-2 w-0.5 rotate-[85deg] rounded-full" />
              </span>
              <span className="text-foreground/92 truncate text-lg font-semibold">
                {row}
              </span>
              {index % 3 === 0 ? (
                <span className="bg-success text-success-foreground grid size-8 place-items-center rounded-full text-xs font-bold">
                  SI
                </span>
              ) : (
                <span aria-hidden="true" />
              )}
            </div>
          ))}
        </div>
      </section>

      <div
        aria-hidden="true"
        className="pointer-events-none fixed right-0 bottom-0 left-0 h-44 bg-[radial-gradient(ellipse_at_50%_70%,color-mix(in_srgb,#ffffff_12%,transparent),transparent_28%),linear-gradient(transparent,color-mix(in_srgb,var(--background)_96%,transparent)_56%)]"
      />
      <CompactBottomNavPreview />
    </main>
  );
};

export default BottomNavPreviewPage;
