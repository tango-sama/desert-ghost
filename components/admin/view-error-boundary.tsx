"use client";

// Catches a throw inside ONE admin view.
//
// The segment boundary (app/(admin)/error.tsx) already stops a broken view from
// showing Next's bare "This page couldn't load" page, but it still replaces the
// whole panel — sidebar, tabs and all — to do it. That is a heavy price for one
// bad tab: the owner loses access to orders and products because a dashboard
// she was not even using threw.
//
// This sits around the active view only, so the shell survives and the other
// ten tabs stay usable. Remount it with a `key` (the shell passes the active
// ViewKey) and the error state clears, so switching away and back re-renders a
// view that has since recovered.
//
// A class component because `componentDidCatch` has no hook equivalent — React
// still offers no way to catch a render error from a function component.
import { Component, type ReactNode } from "react";

type Props = { children: ReactNode; label: string };
type State = { error: (Error & { digest?: string }) | null };

export class ViewErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Same `[DS]` prefix as the data layer, and the component stack too — it is
    // what names the failing component when the message alone is generic.
    console.error(`[DS] view error (${this.props.label})`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const detail = [error.message, error.digest && `digest: ${error.digest}`]
      .filter(Boolean)
      .join("\n");

    return (
      <div className="rounded-[18px] border border-border bg-card p-6">
        <h3 className="mb-2 text-[1.05rem] font-extrabold">
          تعذّر عرض «{this.props.label}»
        </h3>
        <p className="mb-4 text-[.84rem] leading-7 text-[var(--ink-2)]">
          باقي اللوحة يعمل بشكل طبيعي — يمكنكِ الانتقال إلى تبويب آخر من القائمة.
          إن أردتِ إصلاح هذا التبويب، أرسلي النص التالي كما هو.
        </p>
        <pre
          dir="ltr"
          className="mb-4 max-h-56 overflow-auto rounded-[12px] border border-border bg-[var(--card-2)] p-3 text-left text-[.76rem] leading-6 whitespace-pre-wrap break-words text-[var(--ink-2)] select-all"
        >
          {detail || "(no error message available)"}
        </pre>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="cursor-pointer rounded-[11px] border border-border bg-[var(--card-2)] px-[1.3rem] py-[.7rem] text-[.88rem] font-extrabold text-[var(--ink-2)] transition-all hover:-translate-y-px hover:text-foreground"
        >
          ↻ إعادة المحاولة
        </button>
      </div>
    );
  }
}
