const { DynamoDB } = require("aws-sdk");

const client = new DynamoDB();
const documentClient = new DynamoDB.DocumentClient({ service: client });

const tableName = process.env.DYNAMODB_TABLE;

// TODO careful with pagination for the scan operation (didn't account for it)
//https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Query.Pagination.html
// Maximum dataset size limit is 1MB per page, from what I see
const getDiscordUserPublicAddress = (discordUserID) => {
  // This is likely a very naive way to do this search, but I don't have time currently
  // to learn the dynamoDB details and optimize
  var queryParams = {
    TableName: tableName,
    FilterExpression:
      "DiscordUserID = :discordUserID AND Authenticated = :authenticated",
    ExpressionAttributeValues: {
      ":discordUserID": discordUserID,
      ":authenticated": true,
    },
  };

  console.log({ queryParams });
  return documentClient.scan(queryParams).promise();
};

module.exports = { getDiscordUserPublicAddress };