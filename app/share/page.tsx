import { Suspense } from "react";
import { ShareView } from "@/components/share-view";

export default function SharePage() {
  return (
    <Suspense>
      <ShareView />
    </Suspense>
  );
}
