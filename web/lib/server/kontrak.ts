// HANYA server: kontrak baca-saja lewat RPC server (kunci Alchemy tidak terkirim ke browser)
import { Contract, JsonRpcProvider } from "ethers";
import kontrak from "../contract.json";

let provider: JsonRpcProvider | null = null;

export function kontrakBaca() {
  provider ??= new JsonRpcProvider(process.env.RPC_URL_SERVER, kontrak.chainId, { staticNetwork: true });
  return new Contract(kontrak.address, kontrak.abi, provider);
}
