"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookHeart, Flame, Heart, Home, Menu, Plus, Settings, Shirt, Sparkles, Wand2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** Bottom bar on phones (the stylist lives only in the floating hanger button, never in a menu). */
const bottomNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { href: "/upload", label: "Upload", icon: Plus, centre: true },
  { href: "/trends", label: "Trends", icon: Flame },
  { href: "/try-on", label: "Try on", icon: Sparkles },
];

/** Everything else, alphabetical. */
const menuNav = [
  { href: "/try-on", label: "Fitting room", icon: Sparkles },
  { href: "/lookbook", label: "Lookbook", icon: BookHeart },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/style", label: "Style me", icon: Wand2 },
  { href: "/trends", label: "Trends", icon: Flame },
  { href: "/upload", label: "Upload", icon: Plus },
  { href: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
];

/** A little ribbon bow (Coquette Bow theme). */
export function Bow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 20" className={className} aria-hidden="true">
      <path d="M16 9c-3-5-9-8-13-6-3 2-2 9 2 10 3 1 8-1 11-4Zm0 0c3-5 9-8 13-6 3 2 2 9-2 10-3 1-8-1-11-4Z" fill="currentColor" />
      <path d="M14 10 10 19l3-1 2 2 1-9m2-1 4 9-3-1-2 2-1-9" fill="currentColor" opacity=".85" />
      <circle cx="16" cy="9.5" r="2.4" fill="currentColor" />
    </svg>
  );
}

/** The stylist's icon: a t-shirt on a hanger. */
export function HangerTee({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2.6a1.9 1.9 0 0 1 1.9 1.9c0 .9-.6 1.4-1.2 1.8-.4.2-.7.5-.7.9v.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 7.8 3.2 12.4c-.6.3-.4 1.2.3 1.2H6l.6 7.6h10.8l.6-7.6h2.5c.7 0 .9-.9.3-1.2L12 7.8Z" fill="currentColor" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const onStylist = pathname.startsWith("/stylist");

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-dashed border-lace bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-1.5">
            <span className="font-serif text-[26px] font-semibold italic tracking-tight text-foreground">Closet</span>
            <Bow className="h-3.5 w-6 text-primary transition-transform group-hover:rotate-6" />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {[bottomNav[0], ...menuNav.filter((n) => n.href !== "/settings")].map((n) => (
              <Link
                key={n.href + n.label}
                href={n.href}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground",
                  isActive(n.href) && "bg-secondary text-accent-foreground"
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full p-2 hover:bg-secondary" aria-label="Menu">
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-2xl">
              {menuNav.map((n) => (
                <DropdownMenuItem key={n.href + n.label} asChild>
                  <Link href={n.href}>
                    <n.icon /> {n.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-12">{children}</main>

      {/* The stylist: a hanger-tee button in the corner of every page */}
      <Link
        href="/stylist"
        aria-label="Ask your stylist"
        title="Ask your stylist"
        className={cn(
          "group fixed bottom-24 right-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(200,16,46,0.35)] ring-4 ring-background transition-transform hover:scale-105 md:bottom-6 md:right-6",
          onStylist && "ring-secondary"
        )}
      >
        <HangerTee className="size-7 animate-sway" />
        <span className="pointer-events-none absolute right-full mr-2 hidden whitespace-nowrap rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background group-hover:md:block">
          Ask your stylist
        </span>
      </Link>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-dashed border-lace bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5">
          {bottomNav.map((n) =>
            n.centre ? (
              <Link key={n.href} href={n.href} className="flex flex-col items-center" aria-label="Upload">
                <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-foreground text-background shadow-lg ring-4 ring-background">
                  <n.icon className="size-6" />
                </span>
                <span className="mt-0.5 text-[11px] font-semibold text-muted-foreground">{n.label}</span>
              </Link>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                className={cn("flex flex-col items-center gap-0.5 py-1 text-[11px] font-semibold text-muted-foreground", isActive(n.href) && "text-primary")}
              >
                <n.icon className="size-5" />
                {n.label}
              </Link>
            )
          )}
        </div>
      </nav>
    </div>
  );
}
