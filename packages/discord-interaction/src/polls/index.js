const { Lambda, EventBridge } = require("aws-sdk");
const { v1: uuidv1 } = require("uuid");
const { Client: DiscordClient, MessageEmbed } = require("discord.js");

const eventBridge = new EventBridge();
const lambda = new Lambda();
const client = new DiscordClient();

// Note: I'm using Discord.js v12.5.3 because v13 is only compatible with node 16.
// Lambda currently only allows for node 14.

client.login(process.env.DISCORD_BOT_TOKEN);

const waitForClient = () => {
  return new Promise((resolve, reject) => {
    // client.isReady is not available in v12.5.3, so I used uptime
    if (client.uptime == null) {
      client.on("ready", () => {
        resolve();
      });
    }
    // If uptime != null, client is ready - resolve immediately
    else {
      resolve();
    }
  });
};

exports.startPoll = async function (event, context) {
  console.log(JSON.stringify(event, null, 2));
  await waitForClient();

  // https://discord.js.org/#/docs/main/master/class/MessageEmbed
  const embed = new MessageEmbed()
    // Set the title of the field
    .setTitle("DAO Treasury Poll")
    // Set the color of the embed
    .setColor(0xff0000)
    // Set the main content of the embed
    .setDescription("Form this string with the parameters introduced in the slash command.");

  const message = await client.channels.cache.get(event.channelID).send(embed);
  
  //await scheduleResultsCounting({
  //  messageID: message.id
  //});

  return true;
};

exports.resolvePoll = async function (event, context) {
  console.log("Resolve poll.");
  return true;
};

// Schedule the Lambda function which will count the results
async function scheduleResultsCounting(params) {
  const ruleName = `poll-results-rule-${uuidv1()}`;
  // Create EventBridge rule
  // This will use the default event bus
  // TODO Clean up the rule once it has ran
  const rule = await eventBridge
    .putRule({
      Name: ruleName,
      ScheduleExpression: "cron(0/1 * * * ? *)",
    })
    .promise();

  // Save time by doing the two requests at once
  await Promise.all([
    // Grant permission to this EventBridge rule to call the Lambda that counts the votes
    lambda
      .addPermission({
        Action: "lambda:InvokeFunction",
        FunctionName: envVariables.DISCORD_POLL_RESOLVE_FUNCTION_ARN,
        Principal: "events.amazonaws.com",
        StatementId: ruleName,
        SourceArn: rule.RuleArn,
      })
      .promise(),

    // Put the lambda in the targets of the EventBridge rule
    eventBridge
      .putTargets({
        Rule: ruleName,
        Targets: [
          {
            Id: `${ruleName}-target`,
            Arn: envVariables.DISCORD_POLL_RESOLVE_FUNCTION_ARN,
            Input: `{ "data": "${JSON.stringify(params.messageID)}" }`,
          },
        ],
      })
      .promise(),
  ]);

  return true;
}
