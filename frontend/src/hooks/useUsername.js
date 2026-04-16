import { useUsernameQuery } from "@initia/interwovenkit-react";

/**
 * Resolves a .init username for any address.
 * Uses InterwovenKit's built-in hook which queries Initia L1.
 * Returns: "wolf.init" | null | undefined (undefined while loading)
 *
 * For the connected wallet's own username, use kit.username directly
 * from useInterwovenKit() — it's already resolved.
 */
export function useUsername(address) {
  const { data: username, isLoading } = useUsernameQuery(address);
  return { username: username ?? null, isLoading };
}

/**
 * Format: returns username if available, otherwise shortened hex address.
 * e.g. "wolf.init" or "0x3f4d...8a2c"
 */
export function useDisplayName(address) {
  const { username } = useUsername(address);
  if (!address) return null;
  return username || `${address.slice(0, 6)}...${address.slice(-4)}`;
}
