const ethers = require('ethers');
const enzymefinance = require('@enzymefinance/protocol');

const provider = new ethers.providers.JsonRpcProvider(
  process.env.ETHEREUM_NODE_ENDPOINT,
  "kovan"
);
const randomWallet = ethers.Wallet.createRandom().connect(provider);

exports.getVaultOwner = async (event, context) => {
  const parameters = event.queryStringParameters;

  const vaultAddress = parameters["vaultAddress"];

  const vault = new enzymefinance.VaultLib(vaultAddress, randomWallet);
  const owner = await vault.getOwner();

  return {
    statusCode: 200,
    body: JSON.stringify({ message: owner }),
  };
};
