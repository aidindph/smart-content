export default function DashboardLoading() {
  return <div aria-busy="true" aria-live="polite" className="mx-auto max-w-6xl"><div className="h-8 w-56 animate-pulse rounded-xl bg-line" /><div className="mt-4 h-5 w-96 max-w-full animate-pulse rounded-lg bg-line" /><div className="mt-8 grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div className="panel h-32 animate-pulse" key={index} />)}</div><span className="sr-only">در حال بارگذاری</span></div>;
}
