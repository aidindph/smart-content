import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "موتور هوشمند محتوا",
    template: "%s | موتور هوشمند محتوا",
  },
  description: "داشبورد یکپارچهٔ تولید محتوای متنی و تصویری با هوش مصنوعی",
  authors: [{ name: "Aidin Ghassemi", url: "https://github.com/aidindph" }],
  creator: "Aidin Ghassemi",
  publisher: "Parsnest",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
