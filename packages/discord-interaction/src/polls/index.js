const { Lambda, EventBridge } = require("aws-sdk");
const { v1: uuidv1 } = require("uuid");
const { Client: DiscordClient, MessageEmbed } = require("discord.js");
require("discord-reply"); // Enables replies with decorator (only available on discord.js v13)
const { getDiscordUserPublicAddress } = require("./models/authentication");

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

  return true;
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

  // DEBUG
  // When I tried, the results actually always came ordered by UpdatedAt,
  // but since I'm not sure if that's granted to happen (as I'm not defining order
  // in "./models/authentication"), I'm filtering for the maximum here
  //const data = await getDiscordUserPublicAddress("657360013509263374");
  //const publicAddress = getLatestAddress(data.Items);
  //console.log(data);
  //console.log(`LATEST: ${publicAddress}`);
  // DEBUG

  const message = await client.channels.cache
    .get(event.channelID)
    .messages.fetch(event.messageID);

  const userReactions = await getUsersThatReactedWith(message, ["👍", "👎"]);
  console.log(JSON.stringify(userReactions));
  const reactionScores = await getReactionScores(userReactions);
  console.log(JSON.stringify(reactionScores));
  //DEBUG

  await message.lineReplyNoMention(JSON.stringify(userReactions));

  console.log(`CONTEXT ${JSON.stringify(context)}`);
  console.log(`EVENT ${JSON.stringify(event)}`);
  // Clean up the scheduling rule
  await deleteEventBridgeRule(event.eventBridgeRuleName);
  return true;
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

function getAddressByDiscordUserID(discordUserID) {

}

// Given all the addresses that a certain discord user ID has registered in the database,
// get the one that the user authenticated most recently
function getLatestAddress(addresses) {
  var maxDate = new Date(0);
  var latestAddressIndex = 0;

  addresses.map(function (obj, index) {
    updatedDate = new Date(obj.UpdatedAt);
    if (updatedDate > maxDate) {
      maxDate = updatedDate;
      latestAddressIndex = index;
    }
  });
  return addresses[latestAddressIndex].PublicAddress;
}

// Get array of objects with reactions to a specific message
// Each object has an emoji identifier and a list of users that reacted with that emoji
async function getUsersThatReactedWith(message, emojis) {
  // Loop through all the emojis and return an array of objects where each one has
  // the respective emoji and a promise with the users
  const allReactionsPromises = emojis.map(async (emoji) => {
    return {
      emoji: emoji,
      // Note: the maximum number of users to fetch like this is 100. Didn't look further on how to
      // get an unlimited number of users
      // https://discord.js.org/#/docs/main/12.5.3/class/ReactionUserManager?scrollTo=fetch
      users: await message.reactions.resolve(emoji).users.fetch({ limit: 100 }),
    };
  });

  // return promise that will resolve once the fetching of all the users for the different emojis has finished
  return Promise.all(allReactionsPromises);
}

// Loop through all the reaction emojis, fetch the number of shares that each user has and calculate a score
// for each reaction
/*
async function getReactionScores(userReactions) {
  const reactionsWithSharesPromises = userReactions.map(async (reactions) => {
    return {
      emoji: reactions.emoji,
      shares: reactions.users.filter(user => {
        // Remove the reactions from the bot
        return user.username !== "dao-treasury-management";
      }).map(async (user) => {
        return {
          user: user.username,
          // Just to test that the recursive promise all works
          shares: await sleep(1, user.id)
        }
      })
    };
  })
  // I have nested promises here in the users field and need to wait for those to finish
  var reactionsWithShares = await recursiveObjectPromiseAll(reactionsWithSharesPromises);
  return reactionsWithShares;
}
*/
async function getReactionScores(userReactions) {
  const reactionsWithSharesPromises = userReactions.map(async (reactions) => {
    return {
      emoji: reactions.emoji,
      shares: reactions.users.map(async (user) => {
        return {
          username: user.username,
          // Just to test that the recursive promise all works
          shares: await sleep(1, user.id),
        };
      }),
    };
  });
  // I have nested promises here in the users field and need to wait for those to finish
  return recursiveObjectPromiseAll(
    reactionsWithSharesPromises
  );
}

function sleep(time, userID) {
  return new Promise((resolve) => setTimeout(resolve(userID), time));
}

// From https://gist.github.com/voxpelli/2c9b58e5fef9ed46a2cbfef21416d0e2
const zipObject = function (keys, values) {
  const result = {};
  keys.forEach((key, i) => {
    result[key] = values[i];
  });
  return result;
};

const recursiveObjectPromiseAll = function (obj) {
  const keys = Object.keys(obj);
  return Promise.all(
    keys.map((key) => {
      const value = obj[key];
      // Promise.resolve(value) !== value should work, but !value.then always works
      if (typeof value === "object" && !value.then) {
        return recursiveObjectPromiseAll(value);
      }
      return value;
    })
  ).then((result) => zipObject(keys, result));
};