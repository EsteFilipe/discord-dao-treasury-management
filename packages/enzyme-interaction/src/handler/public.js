// Dependencies are installed in the .src/dependencies_layer to save on deployment time
const { Wallet, utils, providers } = require('ethers');
const { VaultLib } = require('@enzymefinance/protocol');

const provider = new providers.JsonRpcProvider(
  process.env.ETHEREUM_NODE_ENDPOINT,
  "kovan"
);
// Using random wallet for routes that don't need a specific access to the vault
const randomWallet = Wallet.createRandom().connect(provider);

const SHARES_TOKEN_DECIMALS = 18;

// TODO: error handling
exports.getVaultInfo = async (event, context) => {
  const parameters = event.queryStringParameters;
  const field = parameters["field"];
  // Get the address of the owner of the vault
  if (field == "owner") {
    const vaultAddress = parameters["vaultAddress"];
    const vault = new VaultLib(vaultAddress, randomWallet);
    const owner = await vault.getOwner();
    return {
      statusCode: 200,
      body: JSON.stringify({ address: owner }),
    };
  }
  // Get the shares balance of a given investor address 
  else if (field == "shares-balance") {
    const vaultAddress = parameters["vaultAddress"];
    const investorAddress = parameters["investorAddress"];
    const vault = new VaultLib(vaultAddress, randomWallet);
    const balance = await vault.balanceOf(investorAddress);
    return {
      statusCode: 200,
      body: JSON.stringify({
        balance: hexAmountToDecimal(balance, SHARES_TOKEN_DECIMALS),
      }),
    };
  }
};

function hexAmountToDecimal(hexAmount, decimals) {
  return utils.formatUnits(hexAmount, decimals);
}