// Connect MetaMask + pastikan jaringan sesuai contract.json
import { BrowserProvider, Contract, type JsonRpcSigner } from "ethers";
import kontrak from "./contract.json";
import { jaringan } from "./chain";

type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown>; isMetaMask?: boolean };
type Pengumuman = { info: { rdns: string; name: string }; provider: Eip1193 };

// Pilih MetaMask secara spesifik (EIP-6963). Kalau ada ekstensi wallet lain, window.ethereum bisa saja milik wallet itu.
function cariMetaMask(): Promise<Eip1193 | undefined> {
  return new Promise((resolve) => {
    const daftar: Pengumuman[] = [];
    const dengar = (e: Event) => daftar.push((e as CustomEvent<Pengumuman>).detail);
    window.addEventListener("eip6963:announceProvider", dengar);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setTimeout(() => {
      window.removeEventListener("eip6963:announceProvider", dengar);
      const w = window as unknown as { ethereum?: Eip1193 & { providers?: Eip1193[] } };
      resolve(
        daftar.find((d) => d.info.rdns === "io.metamask")?.provider ??
          w.ethereum?.providers?.find((p) => p.isMetaMask) ??
          (daftar.length ? undefined : w.ethereum), // tanpa EIP-6963: pakai window.ethereum
      );
    }, 200);
  });
}

export async function connect(): Promise<JsonRpcSigner> {
  const eth = await cariMetaMask();
  if (!eth) throw new Error("METAMASK_TIDAK_ADA");
  await eth.request({ method: "eth_requestAccounts" });
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: jaringan.chainIdHex }] });
  } catch (e) {
    if ((e as { code?: number }).code !== 4902) throw e;
    await eth.request({
      method: "wallet_addEthereumChain",
      params: [{
        chainId: jaringan.chainIdHex,
        chainName: jaringan.nama,
        nativeCurrency: { name: jaringan.mataUang, symbol: jaringan.mataUang, decimals: 18 },
        rpcUrls: [jaringan.rpc],
        blockExplorerUrls: jaringan.explorer ? [jaringan.explorer] : undefined,
      }],
    });
  }
  return new BrowserProvider(eth).getSigner();
}

export const kontrakDengan = (signer: JsonRpcSigner) => new Contract(kontrak.address, kontrak.abi, signer);
