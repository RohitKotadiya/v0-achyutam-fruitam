import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Admin | Achyutam Fruitam - POS",
    template: "%s | Admin | Achyutam Fruitam - POS",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
