"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download } from "lucide-react";

export default function PreviewPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-50 flex h-12 items-center justify-between gap-4 border-b border-border bg-card px-4">
        <Link
          href={`/businesses/${id}`}
          className="shrink-0 text-sm font-medium text-foreground hover:underline"
        >
          ← Back to business
        </Link>
        <div className="flex min-w-0 items-center gap-4">
          <span className="truncate text-sm text-muted-foreground">
            Draft preview — not a live website
          </span>
          <a
            href={`/api/businesses/${id}/export-code`}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Download className="h-4 w-4" />
            Download ZIP
          </a>
        </div>
      </header>
      <div className="pt-12">
        <iframe
          src={`/api/businesses/${id}/website-preview`}
          title="Generated website draft preview"
          className="h-[calc(100vh-3rem)] w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
