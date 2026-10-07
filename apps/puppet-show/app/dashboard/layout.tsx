import { DashboardContainer } from "@/components/dashboard/DashboardContainer";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DashboardContainer>{children}</DashboardContainer>;
}
