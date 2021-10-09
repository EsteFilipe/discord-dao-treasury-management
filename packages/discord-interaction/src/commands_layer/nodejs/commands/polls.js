const { Lambda } = require("aws-sdk");
const {
  SlashCommand,
  ApplicationCommandPermissionType,
  CommandOptionType
} = require("slash-create");
const fs = require("fs");
const axios = require("axios");

const file = fs.readFileSync("/tmp/.env");
const envVariables = JSON.parse(file);
const lambda = new Lambda();

const TOKEN_CHOICES = [
    {
      name: "WETH",
      value: "WETH",
    },
    {
      name: "BAT",
      value: "BAT",
    },
    {
      name: "BNB",
      value: "BNB",
    },
    {
      name: "SNX",
      value: "SNX",
    },
    {
      name: "UNI",
      value: "UNI",
    },
    {
      name: "USDT",
      value: "USDT",
    },
  ];

module.exports = class PollCommand extends SlashCommand {
  constructor(creator) {
    super(creator, {
      name: "poll",
      description: "Create a poll.",
      guildIDs: [envVariables.DISCORD_SERVER_ID],
      // Only owner can call
      defaultPermission: false,
      permissions: {
        [envVariables.DISCORD_SERVER_ID]: [
          {
            type: ApplicationCommandPermissionType.ROLE,
            id: envVariables.DISCORD_OWNER_ROLE_ID,
            permission: true,
          },
        ],
      },
      options: [
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "yes-no",
          description:
            "🗳️ A poll to decide whether or not a specific trade should be executed.",
          options: [
            {
              type: CommandOptionType.INTEGER,
              name: "duration",
              description: "The duration of the poll in minutes (int).",
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: "token-sell-ticker",
              description: "The ticker of the token to sell (string).",
              required: true,
              // Note: an option holds a maximum of 25 choices, so it's not feasible
              // to fetch all the available tokens to trade from the graph and dump them here.
              // To make all the tokens available, this field must be open-ended and receive a string.
              choices: TOKEN_CHOICES,
            },
            {
              type: CommandOptionType.NUMBER, // decimal
              name: "token-sell-amount",
              description: "The amount of the token to sell (float/int).",
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: "token-buy-ticker",
              description: "The ticker of the token to buy (string).",
              required: true,
              choices: TOKEN_CHOICES,
            },
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "choose-token",
          description:
            "📊 A poll where the token to sell is defined, and the investors choose which token to buy.",
          options: [
            {
              type: CommandOptionType.INTEGER,
              name: "duration",
              description: "The duration of the poll (in minutes).",
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: "token-sell-ticker",
              description: "The ticker of the token to sell (string).",
              required: true,
              choices: TOKEN_CHOICES,
            },
            {
              type: CommandOptionType.NUMBER,
              name: "token-sell-amount",
              description: "The amount of the token to sell (float/int).",
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: "token-buy-ticker-1",
              description: "Option 1 token to buy (string).",
              required: true,
              choices: TOKEN_CHOICES,
            },
            // Minimum 2 options
            {
              type: CommandOptionType.STRING,
              name: "token-buy-ticker-2",
              description: "Option 2 token to buy (string).",
              required: true,
              choices: TOKEN_CHOICES,
            },
            {
              type: CommandOptionType.STRING,
              name: "token-buy-ticker-3",
              description: "Option 3 token to buy (string).",
              required: false,
              choices: TOKEN_CHOICES,
            },
            {
              type: CommandOptionType.STRING,
              name: "token-buy-ticker-4",
              description: "Option 4 token to buy (string).",
              required: false,
              choices: TOKEN_CHOICES,
            },
            // Maximum 5 options
            {
              type: CommandOptionType.STRING,
              name: "token-buy-ticker-5",
              description: "Option 5 token to buy (string).",
              required: false,
              choices: TOKEN_CHOICES,
            },
          ],
        },
      ],
    });
    this.filePath = __filename;
  }

  async run(ctx) {
    try {
      var pollParams = {};
      if (ctx.options["yes-no"]) {
        pollParams.pollType = "yes-no";
        for(var k in ctx.options["yes-no"]) 
          pollParams[k] = ctx.options["yes-no"][k];
      }
      else if (ctx.options["choose-token"]) {
        pollParams.pollType = "choose-token";
        for (var k in ctx.options["choose-token"])
          pollParams[k] = ctx.options["choose-token"][k];
      }
      const res = await invokePollStartLambda(pollParams);
      //ctx.send("The poll creation has been requested.", {
      ctx.send(JSON.stringify(pollParams), {
        ephemeral: true,
      });
    }
    catch (e) {
      ctx.send(`Error: ${e.message}`, {
        ephemeral: true,
      });
    }
  }
};

function invokePollStartLambda(pollParams) {
  return new Promise((resolve, reject) => {
    const params = {
      FunctionName: "discord-poll-start",
      InvokeArgs: JSON.stringify({
        channelID: envVariables.DISCORD_CHANNEL_ID,
        pollParams
      }),
    };
    // invokeAsync - we don't wait for the lambda to finish running,
    // just need to get the response on whether invocation was successful
    lambda.invokeAsync(params, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}


