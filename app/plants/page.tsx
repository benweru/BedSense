import { BedSenseApp } from "@/components/bed-sense-app";

export const dynamic = "force-dynamic";

function isEnvDemoFlag(): boolean {
  const flag = process.env.MOCK_META?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export default function PlantsPage() {
  return <BedSenseApp plants initialDemoMode={isEnvDemoFlag()} />;
}
