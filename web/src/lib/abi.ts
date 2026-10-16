import { parseAbi } from 'viem';

/** Bagian ABI PusakaIjazah yang dibaca peramban (lengkap: `abi/PusakaIjazah.json`). */
export const abiPusaka = parseAbi([
  'struct Ijazah { bytes32 docHash; address penandaTangan; uint64 waktuTerbit; uint64 waktuCabut; }',
  'function periksa(bytes32 docHash) view returns (uint8 status, uint256 tokenId, Ijazah data)',
  'function ijazah(uint256 tokenId) view returns (Ijazah)',
  'function tokenURI(uint256 tokenId) view returns (string)',
  'error IjazahTidakAda(uint256 tokenId)',
]);
