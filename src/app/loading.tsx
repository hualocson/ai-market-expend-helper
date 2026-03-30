import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <main className="bg-background relative flex min-h-svh items-center justify-center px-6 pb-[calc(100px+env(safe-area-inset-bottom)-12px)]">
      <Loader size={80} />
    </main>
  );
}
