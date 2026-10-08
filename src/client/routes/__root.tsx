import { createRootRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: () => <p className="py-10 text-center text-stone-500">ページが見つかりません</p>,
});

const navLink =
  "rounded-full px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-200/60 dark:text-stone-300 dark:hover:bg-stone-800";
const navLinkActive = "bg-stone-200/80 font-medium text-stone-900 dark:bg-stone-800 dark:text-stone-50";

function RootLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4">
      <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between bg-stone-50/90 px-4 py-3 backdrop-blur dark:bg-stone-950/90">
        <Link to="/" className="text-lg font-bold tracking-tight">
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
      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-stone-200 py-4 text-xs text-stone-500 dark:border-stone-800">
        <span>日記をエクスポート</span>
        {/* API がファイル名付きで返すので、ルーターを通さず普通のリンクでダウンロードする */}
        <a href="/api/export?format=json" download className="underline hover:text-stone-800 dark:hover:text-stone-200">
          JSON
        </a>
        <a
          href="/api/export?format=markdown"
          download
          className="underline hover:text-stone-800 dark:hover:text-stone-200"
        >
          Markdown
        </a>
      </footer>
    </div>
  );
}
