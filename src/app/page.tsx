import Link from "next/link";

import { ExternalLink } from "lucide-react";

import AIInput from "@/components/AIInput";

const LINK =
  "https://docs.google.com/spreadsheets/d/1Li8wcsOnsEMN-Q3PFYYns2UvZ_8cTXdgH07RiPbiPe0/edit?gid=0#gid=0";

export default function Home() {
  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="mb-2 text-3xl font-light">Expense Tracker</h1>
          <p className="text-muted-foreground">
            Add expenses naturally with AI assistance
          </p>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-lg">
          <AIInput />
        </div>

        {/* Footer Link */}
        <div className="mt-16 text-center">
          <Link
            href={LINK}
            target="_blank"
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-600"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
            View Google Sheet
          </Link>
        </div>
      </div>
    </div>
  );
}
