import HapticsTestPanel from "./HapticsTestPanel";

const HapticsTestPage = () => {
  return (
    <main className="mx-auto flex min-h-[calc(100svh-100px-env(safe-area-inset-bottom))] w-full max-w-md flex-col gap-5 px-4 py-6">
      <header className="space-y-2">
        <h1 className="text-foreground text-2xl font-semibold">Haptics Test</h1>
        <p className="text-muted-foreground text-sm">
          Use a supported mobile browser.
        </p>
      </header>
      <HapticsTestPanel />
    </main>
  );
};

export default HapticsTestPage;
