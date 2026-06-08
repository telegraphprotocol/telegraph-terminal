"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

function subscribeToClient() {
  return () => {};
}

function getClientSnapshot() {
  return true;
}

function getServerSnapshot() {
  return false;
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );

  const isDark = theme === "dark";

  if (!mounted) {
    return (
      <button
        className="flex h-8 w-8 items-center justify-center opacity-0"
        aria-hidden="true"
        tabIndex={-1}
      />
    );
  }

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-8 w-8 shrink-0 items-center justify-center border border-border/60 text-muted-foreground transition-all hover:border-foreground/30 hover:text-foreground"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
