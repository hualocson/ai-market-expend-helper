import Link from "next/link";

import AIInput from "@/components/AIInput";

const LINK =
  "https://docs.google.com/spreadsheets/d/1Li8wcsOnsEMN-Q3PFYYns2UvZ_8cTXdgH07RiPbiPe0/edit?gid=0#gid=0";

export default function Home() {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-24">
      <div className="mx-auto flex w-full max-w-md items-center justify-end">
        <Link
          href={LINK}
          target="_blank"
          className="text-muted-foreground underline"
          rel="noopener noreferrer"
        >
          Open sheet
        </Link>
      </div>
      <AIInput />
    </div>
  );
}
