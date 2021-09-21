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

function gql(endpoint) {
  return subgraph.getSdk(new graphQLRequest.GraphQLClient(endpoint));
}

async function getToken(assetProperty, assetPropertyValue) {
  const result = await gql(process.env.SUBGRAPH_ENDPOINT).assets();
  return result.assets.find(
    (asset) => asset[assetProperty] === assetPropertyValue
  );
}

async function getTokens() {
  const result = await gql(process.env.SUBGRAPH_ENDPOINT).assets();
  console.log(JSON.stringify(result, null, 2))
  return result;
}

async function getTradeDetails(sellToken, buyToken, sellTokenAmount) {
    const path = [sellToken.id, buyToken.id];
    const minIncomingAssetAmount = ethers.utils
      .parseUnits("1", buyToken.decimals)
      .mul(BigNumber.from(10).pow(buyToken.decimals))
      .div(BigNumber.from(10).pow(buyToken.decimals * 2 - 1));
    const outgoingAssetAmount = sellTokenAmount;

    return {
      path,
      minIncomingAssetAmount,
      outgoingAssetAmount,
    };
}

async function getHoldings() {
  const holdingsAddresses = await vault.getTrackedAssets();
  //console.log(holdingsAddresses);
  const holdings = await Promise.all(
    holdingsAddresses.map((item) => getToken("id", item.toLowerCase()))
  );
  console.log(JSON.stringify(holdings, null, 2));
  return holdings;
}

async function getOwner() {
  const owner = await vault.getOwner();
  console.log(`Owner: ${owner}`);
  return owner;
}

async function getBalanceOf(address) {
  const balance = await vault.balanceOf(address);
  console.log(`Balance of ${address}: ${balance}`);
  return balance;
}

getHoldings();
//getOwner();
//getBalanceOf("0xD9CE7116e8702E634854918298C55e07C0443598");
//getTokens();
