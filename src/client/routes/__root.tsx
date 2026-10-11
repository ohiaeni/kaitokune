import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { EmptyState } from "../components/common/EmptyState";
import { buttonVariants } from "../components/ui/button";
import { cn } from "../lib/utils";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <EmptyState>ページが見つかりません</EmptyState>,
});

const navLink = cn(buttonVariants({ variant: "ghost", size: "sm" }), "font-normal text-muted-foreground");
const navLinkActive = "bg-accent font-medium text-accent-foreground";

function RootLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" className="font-bold text-lg tracking-tight">
          kaitokune
        </Link>
        <nav className="flex gap-1">
          <Link to="/" className={navLink} activeProps={{ className: navLinkActive }} activeOptions={{ exact: true }}>
            今日
          </Link>
          <Link to="/entries" className={navLink} activeProps={{ className: navLinkActive }}>
            これまで
          </Link>
          <Link to="/usage" className={navLink} activeProps={{ className: navLinkActive }}>
            使用量
          </Link>
        </nav>
      </header>
      <main className="flex-1 pt-2 pb-16">
        <Outlet />
      </main>
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t py-4 text-muted-foreground text-xs">
        <span>日記をエクスポート</span>
        {/* API がファイル名付きで返すので、ルーターを通さず普通のリンクでダウンロードする */}
        <a href="/api/export?format=json" download className="underline hover:text-foreground">
          JSON
        </a>
        <a href="/api/export?format=markdown" download className="underline hover:text-foreground">
          Markdown
        </a>
      </footer>
    </div>
  );
}
