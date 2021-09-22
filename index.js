const fs = require("fs");
const uniswapSDK = require("@uniswap/sdk");
const enzymeFinance = require("@enzymefinance/protocol");
const ethers = require("ethers");
const graphQLRequest = require("graphql-request");
const subgraph = require("./utils/subgraph/subgraph");
require("dotenv").config();

const provider = new ethers.providers.JsonRpcProvider(
  process.env.NODE_ENDPOINT,
  process.env.NETWORK.toLowerCase()
);

const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
const vault = new enzymeFinance.VaultLib(process.env.VAULT_ADDRESS, wallet);

const SELL_TOKEN_ADDRESS = "0xd0a1e359811322d97991e03f863a0c30c2cf029c"; //WETH
const BUY_TOKEN_ADDRESS = "0x9be41d202e8a1d7327b2fd860749e41baa89cb6a"; //Compound

function gql(endpoint) {
  return subgraph.getSdk(new graphQLRequest.GraphQLClient(endpoint));
}

// Get the addresses for the contracts of the current release
async function getDeployment() {
  const result = await gql(
    process.env.SUBGRAPH_ENDPOINT
  ).currentReleaseContracts();
  return result;
}

async function getVaultInfo(vaultId) {
  const result = await gql(process.env.SUBGRAPH_ENDPOINT).vault({
    id: vaultId,
  });
  return result;
}

// Get info about a token, given a certain property. 'id' property corresponds to contract address
async function getToken(assetProperty, assetPropertyValue) {
  const result = await gql(process.env.SUBGRAPH_ENDPOINT).assets();
  return result.assets.find(
    (asset) => asset[assetProperty] === assetPropertyValue
  );
}

// Get the list of all the tokens that are available to trade with Enzyme Finance
async function getTokens() {
  const result = await gql(process.env.SUBGRAPH_ENDPOINT).assets();
  //console.log(JSON.stringify(result, null, 2))
  return result;
}

async function getTokenBalance(vaultContract, token) {
  const contract = new enzymeFinance.StandardToken(token, provider);
  return contract.balanceOf.args(vaultContract).call();
}

async function getTradeDetails(sellToken, buyToken, sellTokenAmount) {
  const path = [sellToken.id, buyToken.id];
  // minimum incoming asset amount is a very small number, so that it always gets executed
  const minIncomingAssetAmount = ethers.utils
    .parseUnits("1", buyToken.decimals)
    .mul(ethers.BigNumber.from(10).pow(buyToken.decimals))
    .div(ethers.BigNumber.from(10).pow(buyToken.decimals * 2 - 1));
  // outgoing asset amount corresponds to 100% of the holdings for that asset
  const outgoingAssetAmount = sellTokenAmount;

  return {
    path,
    minIncomingAssetAmount,
    outgoingAssetAmount,
  };
}

// Get holdings in the vault
async function getHoldings() {
  const holdingsAddresses = await vault.getTrackedAssets();
  //console.log(holdingsAddresses);
  const holdings = await Promise.all(
    holdingsAddresses.map((item) => getToken("id", item.toLowerCase()))
  );
  return holdings;
}

function hexAmountToDecimal(hexAmount, decimals) {
  return ethers.utils.formatUnits(hexAmount, decimals);
}

async function getHoldingsWithAmounts() {
  const holdings = await getHoldings();
  // get the amount of each holding
  const holdingAmounts = await Promise.all(
    holdings.map((holding) =>
      getTokenBalance(process.env.VAULT_ADDRESS, holding.id)
    )
  );

  // combine holding token data with amounts
  return holdings.map((item, index) => {
    return { ...item, amount: holdingAmounts[index] };
  });
}

// Get the address of the owner of the vault
async function getOwner() {
  const owner = await vault.getOwner();
  console.log(`Owner: ${owner}`);
  return owner;
}

// Get the shares balance of a given address
async function getBalanceOf(address) {
  const balance = await vault.balanceOf(address);
  console.log(`Balance of ${address}: ${balance}`);
  return balance;
}

async function swapTokens(tradeDetails) {
  // Put this contract fetching in an object property like done in the bot to avoid fetching every time
  const contracts = await getDeployment();
  const vaultInfo = await getVaultInfo(process.env.VAULT_ADDRESS);
  const adapter = contracts.network.currentRelease.uniswapV2Adapter;
  const integrationManager = contracts.network.currentRelease.integrationManager;
  const comptroller = vaultInfo.fund.accessor.id;

  const takeOrderArgs = enzymeFinance.uniswapV2TakeOrderArgs({
    path: tradeDetails.path,
    minIncomingAssetAmount: tradeDetails.minIncomingAssetAmount,
    outgoingAssetAmount: tradeDetails.outgoingAssetAmount,
  });

  const callArgs = enzymeFinance.callOnIntegrationArgs({
    adapter,
    selector: enzymeFinance.takeOrderSelector,
    encodedCallArgs: takeOrderArgs,
  });

  const contract = new enzymeFinance.ComptrollerLib(comptroller, wallet);
  return contract.callOnExtension.args(
    integrationManager,
    enzymeFinance.IntegrationManagerActionId.CallOnIntegration,
    callArgs
  );
}

async function trade() {
  const [holdings, buyToken] = await Promise.all([
    getHoldingsWithAmounts(),
    getToken("id", BUY_TOKEN_ADDRESS.toLowerCase()),
  ]);

  const sellToken = holdings.find((asset) => asset.id === SELL_TOKEN_ADDRESS);

  const tradeDetails = await getTradeDetails(
    sellToken,
    buyToken,
    sellToken.amount
  );

  // Here's how to convert the hex amount to decimal format:
  //const hexAmount = hexAmountToDecimal(holdingsWithAmounts[0].amount, holdingsWithAmounts[0].decimals);
  return swapTokens(tradeDetails);
}

async function doStuff() {
  var holdings;
  console.log("HOLDINGS INITIAL");
  holdings = await getHoldingsWithAmounts();
  console.log(JSON.stringify(holdings, null, 2));
  console.log("TRADING....");
  const result = await trade();
	/*
	fs.writeFile("data.json", JSON.stringify(result, null, 2), function (err) {
    if (err) throw err;
  });
	*/
  //console.log(JSON.stringify(result, null, 2));
  console.log("HOLDINGS FINAL");
  holdings = await getHoldingsWithAmounts();
  console.log(JSON.stringify(holdings, null, 2));
}

doStuff();

//getHoldings();
//getOwner();
//getBalanceOf("0xD9CE7116e8702E634854918298C55e07C0443598");
//getTokens();
