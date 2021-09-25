import { APIGatewayEvent, APIGatewayProxyResult } from 'aws-lambda'
import apiResponses from 'src/requests/apiResponses'
import { authenticate, getAuthenticationChallenge } from '../lib/auth'
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { utils } from 'ethers' //providers, Wallet } from 'ethers'
import { VaultLib } from '@enzymefinance/protocol';


/**
 * GET /sessions
 *
 * Returns a nonce given a public address
 * @method nonce
 * @param {String} event.queryStringParameter['PublicAddress']
 * @throws Returns 401 if the user is not found
 * @returns {Object} nonce for the user to sign
 */
export async function nonce(
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> {
  const parameters = event.queryStringParameters

  console.log(parameters)

  const publicAddress = parameters['PublicAddress']
  try {
    const nonce = await getAuthenticationChallenge(publicAddress)
    return apiResponses._200({ nonce })
  } catch (e) {
    return apiResponses._400({ error: e.message })
  }
}

/**
 * POST /sessions
 *
 * Returns a JWT, given a username and password.
 * @method login
 * @param {String} event.body.username
 * @param {String} event.body.signature
 * @throws Returns 401 if the user is not found or signature is invalid.
 * @returns {Object} jwt that expires in 5 mins
 */
export async function login(
  event: APIGatewayEvent
): Promise<APIGatewayProxyResult> {
  const AWS = require("aws-sdk");

  /*
  const provider = new providers.JsonRpcProvider(
    process.env.ETHEREUM_NODE_ENDPOINT,
    'kovan'
  );
  // We don't need a specific wallet here, since we just want to get the address of the vault's manager
  const wallet = Wallet.createRandom().connect(provider);
  const vault = new VaultLib(process.env.VAULT_ADDRESS, wallet);
  */

  const callRoleAssignLambda = async (userId, publicAddress) => {
    const lambda = new AWS.Lambda({region: "us-east-2"});
    return new Promise((resolve, reject) => {
      const params = {
        FunctionName: "discord-role-assign",
        Payload: JSON.stringify({ userId, publicAddress })
      }
      lambda.invoke(params, (err, results) => {
        if(err) reject(err);
        else resolve(results.Payload);
      })
    })
  }

  const getNumberOfShares = async (publicAddress, vaultAddress) => {
    const url =
      "https://kovan-api.ethplorer.io/getAddressInfo/" +
      publicAddress +
      "?apiKey=" +
      process.env.ETHPLORER_KEY;

    try {
      const response = await axios.get(url)
      if (response) {
        if (Array.isArray(response.data.tokens)) {
          const tokensInAddress = response.data.tokens
          const sharesToken = tokensInAddress.find((token) => token.tokenInfo.address === vaultAddress);
          if (sharesToken != undefined) {
            // Returns a string
            return utils.formatUnits(sharesToken.balance.toString(), sharesToken.tokenInfo.decimals);
          }
          else return "0" 
        }
        else return "0"
      }
      else return "-1";
    }
    catch {
      return "-1"
    }
  }

  /*
  const isOwner = async (publicAddress) => {
    // Check if the address corresponds to the owner of the vault
    // Note: I'm assuming that the owner doesn't ever change, but it's possible that I'm
    // not getting the whole story
    const owner = await vault.getOwner();
    if (owner === publicAddress) return true;
    else return false;
  }
  */

  try {
    const { publicAddress, signature, userIdToken } = JSON.parse(event.body)

    const token = await authenticate(publicAddress, signature)
    // If no error was thrown, let's decode the JWT the user gave us (the one they received from Discord)
    // and get the respective Discord user ID and Enzyme vault address
    const decoded = jwt.verify(userIdToken, process.env.JWT_SECRET);
    const userId = decoded.userId;
    // The number of shares that the user owns from this vault
    const [ shares ] = await Promise.all([
      getNumberOfShares(publicAddress, decoded.vaultAddress),
      // TODO Instead of interacting with enzyme finance's vault from here, create an API dedicated only
      // to interacting with Enzyme, which will also be directly acessed by the bot to fetch info like balances, investors, etc.
      //isOwner(publicAddress)
    ]);

    if(shares === "0") {
      return apiResponses._400({ error: "User doesn't own any shares from this vault." })
    }
    else if (shares === "-1") {
      return apiResponses._400({ error: "There's been an error getting the number of shares for this user." })
    }
    else {
      console.log(`Validation successful for userId: ${userId}, with publicAddress: ${publicAddress}.
      Number of shares from vault ${decoded.vaultAddress}: ${shares}`);
      // Call the lambda function to assign the role to that user
      // TODO: make it possible to assign two roles in simultaneous by passing an array of role id's to this lambda
      const results = await callRoleAssignLambda(userId, publicAddress);
      // TODO add `owner` field here again when fetching from the other API is done
      return apiResponses._200({ shares: shares })
    }

  } catch (e) {
    console.log(`Error: ${e.message}`)
    return apiResponses._400({ error: e.message })
  }
}

/**
 * OPTION /{proxy+}
 *
 * Returns proper CORS config
 */
export function defaultCORS(event: APIGatewayEvent): APIGatewayProxyResult {
  const response = {
    // Success response
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({}),
  }
  return response
}
