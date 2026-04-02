import { useState } from "react";
import { useInterwovenKit } from "@initia/interwovenkit-react";
export function useAutosign() {
  const kit = useInterwovenKit();
  const [autosignEnabled, setEnabled] = useState(kit.isAutoSignEnabled ?? false);
  const enableAutosign = async () => {
    try {
      await kit.requestAutoSign?.({
        chainId:     "predx-1",
        description: "PredX trading session",
        duration:    60 * 60 * 4,
      });
      setEnabled(true);
    } catch (err) {
      console.error("Auto-sign failed:", err);
    }
  };
  return { autosignEnabled, enableAutosign };
}
