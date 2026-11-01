"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Shirt, Plus, Sparkles, Flame, Menu, BookHeart, Heart, Settings, Wand2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const bottomNav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { href: "/upload", label: "Upload", icon: Plus, centre: true },
  { href: "/stylist", label: "Stylist", icon: Sparkles },
  { href: "/trends", label: "Trends", icon: Flame },
];

const menuNav = [
  { href: "/style", label: "Style me", icon: Wand2 },
  { href: "/lookbook", label: "Lookbook", icon: BookHeart },
  { href: "/wishlist", label: "Wishlist", icon: Heart },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="font-serif text-2xl font-semibold tracking-tight">
            Closet
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {[...bottomNav, ...menuNav.slice(0, 3)].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground",
                  isActive(n.href) && "bg-accent text-accent-foreground"
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-lg p-2 hover:bg-accent" aria-label="Menu">
              <Menu className="size-5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {menuNav.map((n) => (
                <DropdownMenuItem key={n.href} asChild>
                  <Link href={n.href}>
                    <n.icon /> {n.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 pt-4 md:pb-10">{children}</main>

      {/* Floating stylist button on every page except the chat itself */}
      {!pathname.startsWith("/stylist") && (
        <Link
          href="/stylist"
          aria-label="Ask your stylist"
          className="fixed bottom-24 right-4 z-40 flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform hover:scale-105 md:bottom-6 md:right-6"
        >
          <Sparkles className="size-5" />
        </Link>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5">
          {bottomNav.map((n) =>
            n.centre ? (
              <Link key={n.href} href={n.href} className="flex flex-col items-center" aria-label="Upload">
                <span className="-mt-6 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
                  <n.icon className="size-6" />
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">{n.label}</span>
              </Link>
            ) : (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-1 text-[11px] text-muted-foreground",
                  isActive(n.href) && "text-primary"
                )}
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
