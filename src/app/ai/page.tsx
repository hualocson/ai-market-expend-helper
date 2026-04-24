import AIExpenseChat from "@/components/AIExpenseChat";

const AIChatPage = () => {
  return (
    <section className="relative isolate mx-auto flex min-h-svh max-w-md flex-col overflow-hidden px-4 pt-6 pb-28 sm:px-6 sm:pt-8">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(145deg,#fbf5e8_0%,#eef6ec_48%,#f7ead7_100%)]" />
      <div className="relative mb-5 space-y-2">
        <p className="text-xs font-semibold tracking-[0.28em] text-emerald-900/60 uppercase">
          Spendly AI
        </p>
        <h1 className="text-foreground text-3xl font-semibold tracking-tight">
          AI expense chat
        </h1>
        <p className="text-muted-foreground text-sm leading-6">
          Chat your spending into shape. Send one expense at a time, review the
          draft, then finish it in the regular form.
        </p>
      </div>

      <AIExpenseChat />
    </section>
  );
};

export default AIChatPage;
