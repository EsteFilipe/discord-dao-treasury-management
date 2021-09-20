const enzymeFinance = require("@enzymefinance/protocol");
const ethers = require("ethers");
require("dotenv").config();


const provider = new ethers.providers.JsonRpcProvider(
  process.env.NODE_ENDPOINT,
  process.env.NETWORK.toLowerCase()
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const vault = new enzymeFinance.VaultLib(process.env.VAULT_ADDRESS, wallet);

async function getHoldings() {
    const holdings = await vault.getTrackedAssets();
    console.log(holdings)
    return holdings
}

getHoldings();