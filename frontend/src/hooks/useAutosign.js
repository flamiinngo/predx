import { useInterwovenKit } from "@initia/interwovenkit-react";

/**
 * Auto-sign / Ghost Wallet integration for PredX.
 *
 * How it works:
 *   1. User clicks "Enable Auto-Sign"
 *   2. InterwovenKit opens a drawer — user picks session duration
 *   3. A dedicated Ghost Wallet is derived for this app origin
 *   4. authz + feegrant grants are created on-chain (one-time tx)
 *   5. All subsequent /minievm.evm.v1.MsgCall messages are signed
 *      silently by the Ghost Wallet — no popups for trades
 *
 * Configured in main.jsx:
 *   enableAutoSign={{ "predx-1": ["/minievm.evm.v1.MsgCall"] }}
 */

const CHAIN_ID = "predx-1"; // Our EVM rollup chain ID

export function useAutosign() {
  const { autoSign, isConnected } = useInterwovenKit();

  const isEnabled  = autoSign?.isEnabledByChain?.[CHAIN_ID] ?? false;
  const isLoading  = autoSign?.isLoading ?? false;
  const expiredAt  = autoSign?.expiredAtByChain?.[CHAIN_ID] ?? null;
  const grantee    = autoSign?.granteeByChain?.[CHAIN_ID] ?? null;

  // Friendly expiry display (e.g. "3h 47m remaining")
  const expiryLabel = (() => {
    if (!expiredAt) return null;
    const ms = expiredAt.getTime() - Date.now();
    if (ms <= 0) return "Expired";
    const h = Math.floor(ms / 3_600_000);
    const m = Math.floor((ms % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m remaining`;
    return `${m}m remaining`;
  })();

  const enable = async () => {
    if (!autoSign || !isConnected) return;
    await autoSign.enable(CHAIN_ID);
  };

  const disable = async () => {
    if (!autoSign || !isConnected) return;
    await autoSign.disable(CHAIN_ID);
  };

  const toggle = () => (isEnabled ? disable() : enable());

  return {
    isEnabled,
    isLoading,
    expiredAt,
    expiryLabel,
    grantee,
    enable,
    disable,
    toggle,
  };
}
