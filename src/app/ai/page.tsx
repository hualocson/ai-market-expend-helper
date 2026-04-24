import AIExpenseChat from "@/components/AIExpenseChat";

const AIChatPage = () => {
  return (
    <section className="relative mx-auto flex h-[calc(100svh-96px)] max-w-md flex-col px-4 pt-6 pb-[calc(env(safe-area-inset-bottom)+48px)] sm:px-6 sm:pt-8">
      <header className="shrink-0 pb-4">
        <p className="text-primary/70 text-[11px] font-semibold tracking-[0.32em] uppercase">
          Spendly AI
        </p>
        <h1 className="text-foreground mt-1.5 text-[26px] leading-tight font-semibold tracking-tight">
          AI expense chat
        </h1>
        <p className="text-muted-foreground mt-1.5 text-sm leading-6">
          Chat your spending into shape. Send one expense at a time, review the
          draft, then finish it in the regular form.
        </p>
      </header>

      <AIExpenseChat />
    </section>
  );
};

export default AIChatPage;
