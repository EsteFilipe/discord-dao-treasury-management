// Dependencies are installed in the .src/dependencies_layer to save on deployment time
const ethers = require('ethers');
const enzymefinance = require('@enzymefinance/protocol');

const provider = new ethers.providers.JsonRpcProvider(
  process.env.ETHEREUM_NODE_ENDPOINT,
  "kovan"
);
// Using random wallet for routes that don't need a specific access to the vault
const randomWallet = ethers.Wallet.createRandom().connect(provider);

const SHARES_TOKEN_DECIMALS = 18;

// TODO: error handling
// Get the address of the owner of the vault
exports.getVaultOwner = async (event, context) => {
  const parameters = event.queryStringParameters;
  const vaultAddress = parameters["vaultAddress"];
  const vault = new enzymefinance.VaultLib(vaultAddress, randomWallet);
  const owner = await vault.getOwner();
  return {
    statusCode: 200,
    body: JSON.stringify({ address: owner }),
  };
};

// Get the shares balance of a given investor address
exports.getSharesBalance = async (event, context) => {
  const parameters = event.queryStringParameters;
  const vaultAddress = parameters["vaultAddress"];
  const investorAddress = parameters["investorAddress"];
  const vault = new enzymefinance.VaultLib(vaultAddress, randomWallet);
  const balance = await vault.balanceOf(investorAddress);
  return {
    statusCode: 200,
    body: JSON.stringify({ balance: hexAmountToDecimal(balance, SHARES_TOKEN_DECIMALS) }),
  };
};

function hexAmountToDecimal(hexAmount, decimals) {
  return ethers.utils.formatUnits(hexAmount, decimals);
}