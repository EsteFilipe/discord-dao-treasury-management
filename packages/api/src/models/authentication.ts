import { Owner } from '@aws-sdk/client-s3'
import { DynamoDB } from 'aws-sdk'
import { randomBytes } from 'crypto'

const client = new DynamoDB()
const documentClient = new DynamoDB.DocumentClient({ service: client })

const generateNonce = async () => {
  const buffer = await randomBytes(16)
  return buffer.toString('hex')
}

const tableName = process.env.DYNAMODB_TABLE

// TODO there are several steps here in the table operations that are unnecessary, fix that.

export const createProfile = async (params: { publicAddress: string }) => {
  const queryParams: DynamoDB.DocumentClient.PutItemInput = {
    TableName: tableName,
    Item: {
      PublicAddress: params.publicAddress, //Primary Key
      CreatedAt: new Date().toISOString(),
      UpdatedAt: new Date().toISOString(),
      Nonce: await generateNonce(),
      Authenticated: false
    },
  }

  return documentClient
    .put(queryParams)
    .promise()
    .then((data) => data)
}

export const getNonce = (params: { publicAddress: string }) => {
  const queryParams: DynamoDB.DocumentClient.GetItemInput = {
    TableName: tableName,
    Key: {
      PublicAddress: params.publicAddress,
    },
    ProjectionExpression: 'Nonce',
  }
  console.log({ queryParams })
  return documentClient
    .get(queryParams)
    .promise()
    .then((data) => data.Item?.Nonce)
}

export const updateNonce = async (params: { publicAddress: string }) => {
  const newNonce = await generateNonce()
  const queryParams: DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: tableName,
    Key: {
      PublicAddress: params.publicAddress
    },
    UpdateExpression: 'SET Nonce = :nonce',
    ExpressionAttributeValues: {
      ':nonce': newNonce,
    },
    ReturnValues: 'UPDATED_NEW',
  }
  console.log({ queryParams })
  return documentClient
    .update(queryParams)
    .promise()
    .then((data) => data.Attributes.Nonce)
}

export const updateEnzymeAuthenticated = async (params: 
  { publicAddress: string, discordUserID: string, discordUsername: string, owner: boolean, shares: number }) => {
  const queryParams: DynamoDB.DocumentClient.UpdateItemInput = {
    TableName: tableName,
    Key: {
      PublicAddress: params.publicAddress,
    },
    UpdateExpression: 'SET Authenticated = :authenticated, DiscordUserID = :discordUserID, DiscordUsername = :discordUsername, VaultOwner = :owner, VaultShares = :shares, UpdatedAt = :currentDate',
    ExpressionAttributeValues: {
      ':authenticated': true,
      ':discordUserID': params.discordUserID,
      ':discordUsername': params.discordUsername,
      ':owner': params.owner,
      ':shares': params.shares,
      ':currentDate': new Date().toISOString()
    },
    ReturnValues: 'UPDATED_NEW',
  }
  console.log({ queryParams })
  return documentClient
    .update(queryParams)
    .promise()
    .then((data) => data.Attributes.Nonce)
}
