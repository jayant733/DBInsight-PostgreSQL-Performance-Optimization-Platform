import { Sidebar } from "./Sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-surface-0">
      <Sidebar />
      <div className="flex-1 md:pl-64">
        <main className="p-8 max-w-[1400px] mx-auto min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}
