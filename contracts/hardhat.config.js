require("@nomicfoundation/hardhat-ethers");
require("@nomicfoundation/hardhat-verify");
require("dotenv").config({ quiet: true });

module.exports = {
  solidity: {
    version: "0.8.28",
    // WAJIB "cancun": OpenZeppelin 5.x memakai opcode mcopy (Polygon PoS mendukung sejak hardfork Napoli)
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: {
    amoy: {
      url: process.env.AMOY_RPC_URL || "https://polygon-amoy.drpc.org",
      chainId: 80002,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  // Etherscan API V2: satu key untuk semua explorer, termasuk Polygonscan Amoy
  etherscan: { apiKey: process.env.ETHERSCAN_API_KEY || "" },
  sourcify: { enabled: false },
};
