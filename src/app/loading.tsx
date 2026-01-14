import { Loader } from "@/components/ui/loader";

export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(1200px_circle_at_10%_10%,rgba(236,72,153,0.12),transparent_45%),radial-gradient(900px_circle_at_90%_0%,rgba(59,130,246,0.16),transparent_40%),linear-gradient(180deg,rgba(10,14,28,0.98),rgba(9,10,20,1))] px-6">
      <Loader size={80} />
    </main>
  );
}
