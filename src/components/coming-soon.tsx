import Link from "next/link";

export function ComingSoon({ title, description, phase }: { title: string; description: string; phase: string }) {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-sm font-bold text-brand">{phase}</p>
      <h1 className="mt-2 text-3xl font-black">{title}</h1>
      <div className="panel mt-7 p-7">
        <p className="leading-8 text-muted">{description}</p>
        <Link className="secondary-button mt-6" href="/dashboard">بازگشت به نمای کلی</Link>
      </div>
    </div>
  );
}
