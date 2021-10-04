const { Lambda, EventBridge } = require("aws-sdk");
const { v1: uuidv1 } = require("uuid");
const { Client: DiscordClient, MessageEmbed } = require("discord.js");
require("discord-reply"); // Enables replies with decorator (only available on discord.js v13)

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
  await waitForClient();
  const pollExpirationDate = getPollExpirationDate(event.pollParams.duration);
  // Create poll and add the vote reactions
  const embed = getStartPollEmbed(event.pollParams, pollExpirationDate);
  const message = await client.channels.cache.get(event.channelID).send(embed);
  await addPollVoteReactions(message, event.pollParams);
  
  // Schedule the votes counting and subsequent eventbridge clean-up
  await scheduleResultsCounting(
    message.id,
    event.channelID,
    event.pollParams,
    pollExpirationDate
  );

  return true
};

function getStartPollEmbed(pollParams, pollExpirationDate) {
  // https://discord.js.org/#/docs/main/master/class/MessageEmbed
  const embed = new MessageEmbed()
    // Set the title of the field
    .setTitle("DAO Treasury Poll")
    // Set the color of the embed
    .setColor(0xff0000)
    // Set the main content of the embed
    .setDescription("Yes/No vote for the following trade parameters.")
    .addFields(
      {
        name: "Poll Duration:",
        value: `${pollParams.duration} minutes`,
      },
      {
        name: "Ticker of the token to sell:",
        value: pollParams["token-sell-ticker"],
      },
      {
        name: "Amount of the token to sell:",
        value: pollParams["token-sell-amount"],
      },
      {
        name: "Ticker of the token to buy:",
        value: pollParams["token-buy-ticker"],
      },
      { name: "\u200B", value: "\u200B" }, // Empty space
      { name: "Vote Yes", value: "👍", inline: true },
      { name: "Vote No", value: "👎", inline: true },
      { name: "\u200B", value: "\u200B" },
    )
    .setFooter(`Expires ${pollExpirationDate}`);
  return embed
}

async function addPollVoteReactions(message, pollParams) {
  if (pollParams.pollType === "yes-no") {
    await message.react("👍");
    await message.react("👎");
  }
  else if (pollParams.pollType === "choose-token") {
  }
  return true
}

exports.resolvePoll = async function (event, context) {
  await waitForClient();
  const message = await client.channels.cache
    .get(event.channelID)
    .messages.fetch(event.messageID);

  await message.lineReplyNoMention("Ran lambda to resolve poll.");
  
  console.log(`CONTEXT ${JSON.stringify(context)}`);
  console.log(`EVENT ${JSON.stringify(event)}`);
  // Clean up the scheduling rule
  await deleteEventBridgeRule(event.eventBridgeRuleName);
  return true
};

function getResolvePollEmbed(pollParams) {
  // https://discord.js.org/#/docs/main/master/class/MessageEmbed
  const embed = new MessageEmbed()
    // Set the title of the field
    .setTitle("DAO Treasury Poll")
    // Set the color of the embed
    .setColor(0xff0000)
    // Set the main content of the embed
    .setDescription(
      "Form this string with the parameters introduced in the slash command."
    );
  return embed;
}

// Schedule the Lambda function that will count the poll results
async function scheduleResultsCounting(
  messageID,
  channelID,
  pollParams,
  scheduleDate
) {
  const ruleName = `poll-results-rule-${uuidv1()}`;
  const cronExpression = getScheduleCron(scheduleDate);
  // Create EventBridge rule
  // This will use the default event bus
  const rule = await eventBridge
    .putRule({
      Name: ruleName,
      ScheduleExpression: cronExpression,
    })
    .promise();

  // Save time by doing the two requests at once
  await Promise.all([
    // Grant permission to this EventBridge rule to call the Lambda that counts the votes
    lambda
      .addPermission({
        Action: "lambda:InvokeFunction",
        FunctionName: process.env.DISCORD_POLL_RESOLVE_FUNCTION_ARN,
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
            Arn: process.env.DISCORD_POLL_RESOLVE_FUNCTION_ARN,
            Input: JSON.stringify({
              eventBridgeRuleName: ruleName,
              messageID,
              channelID,
              pollParams,
            }),
          },
        ],
      })
      .promise(),
  ]);

  return true;
}

function getPollExpirationDate(minutes) {
  var currentDate = new Date();
  var expirationDate = new Date();
  expirationDate.setTime(currentDate.getTime() + minutes * 60 * 1000);
  return expirationDate
}

// Get the corresponding cron expression for N minutes from now
// Cron format for AWS here:
// https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-create-rule-schedule.html
function getScheduleCron (scheduleDate) {
    // EventBridge doesn't provide second-level precision in schedule expressions.
    // The finest resolution using a cron expression is one minute. 
    const cronMinutes = scheduleDate.getMinutes(),
      cronHours = scheduleDate.getHours(),
      cronDayOfMonth = scheduleDate.getDate(),
      cronMonth = scheduleDate.getMonth() + 1, // cron is 1-12 for months
      cronDayOfWeek = "?", // cron code for any
      cronYear = scheduleDate.getFullYear();
        
    const cronExpression =
      `cron(` +
      `${cronMinutes} ` +
      `${cronHours} ` +
      `${cronDayOfMonth} ` +
      `${cronMonth} ` +
      `${cronDayOfWeek} ` +
      `${cronYear}` +
      `)`;
    
    return cronExpression
}

async function deleteEventBridgeRule(ruleName) {
  // Delete all the target from the rule
  await eventBridge
    .removeTargets({
      Ids: [`${ruleName}-target`],
      Rule: ruleName,
      Force: true, // just in case, not sure if required here
    })
    .promise();
  // Delete the rule
  await eventBridge
    .deleteRule({
      Name: ruleName,
      Force: true,
    })
    .promise();

  return true
}