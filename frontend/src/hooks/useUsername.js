import { useUsernameQuery } from "@initia/interwovenkit-react";
import { toBech32, fromHex } from "@cosmjs/encoding";

/**
 * Converts any address to init1... bech32 format so InitiaAddress.validate()
 * accepts it and the username registry query succeeds.
 * Already-bech32 addresses are returned unchanged.
 */
function toInitBech32(address) {
  if (!address) return null;
  if (address.startsWith("init1")) return address;
  if (address.startsWith("0x") || address.startsWith("0X")) {
    try {
      return toBech32("init", fromHex(address.slice(2)));
    } catch {
      return null;
    }
  }
  return address;
}

/**
 * Resolves a .init username for any address (hex or bech32).
 * Uses InterwovenKit's built-in hook which queries Initia L1.
 * Returns: "wolf.init" | null | undefined (undefined while loading)
 */
export function useUsername(address) {
  const initAddress = toInitBech32(address);
  const { data: username, isLoading } = useUsernameQuery(initAddress ?? undefined);
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
