import { useEffect, useState } from "react";
const API = "https://rest.testnet.initia.xyz/initia/usernames/v1/names";
const cache = {};
export function useUsername(address) {
  const [username, setUsername] = useState(null);
  useEffect(() => {
    if (!address) return;
    if (cache[address] !== undefined) { setUsername(cache[address]); return; }
    fetch(`${API}/${address}`)
      .then((r) => r.json())
      .then((data) => { const n = data?.name ?? null; cache[address] = n; setUsername(n); })
      .catch(() => { cache[address] = null; });
  }, [address]);
  return username;
}
