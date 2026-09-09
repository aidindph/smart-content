import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "موتور هوشمند محتوا",
    template: "%s | موتور هوشمند محتوا",
  },
  description: "داشبورد یکپارچهٔ تولید محتوای متنی و تصویری با هوش مصنوعی",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
