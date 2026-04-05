import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Bills | Achyutam Fruitam - POS",
    template: "%s | Bills | Achyutam Fruitam - POS",
  },
};

export default function BillsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
