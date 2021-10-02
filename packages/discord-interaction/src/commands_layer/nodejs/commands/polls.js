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
            "A poll to decide whether or not a specific trade should be executed.",
          options: [
            {
              type: CommandOptionType.INTEGER,
              name: "duration",
              description: "The duration of the poll in minutes (int).",
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: "token-ticker-sell",
              description: "The ticker of the token to sell (string).",
              required: true,
              choices: [
                {
                  name: "WETH",
                  value: "WETH",
                },
                {
                  name: "WBTC",
                  value: "WBTC",
                },
                {
                  name: "REN",
                  value: "REN",
                },
              ],
            },
            {
              type: CommandOptionType.STRING,
              name: "token-sell-amount",
              description: "The amount of the token to sell (float/int).",
              required: true,
            },
            {
              type: CommandOptionType.STRING,
              name: "token-ticker-buy",
              description: "The ticker of the token to buy (string).",
              required: true,
              choices: [
                {
                  name: "WETH",
                  value: "WETH",
                },
                {
                  name: "WBTC",
                  value: "WBTC",
                },
                {
                  name: "REN",
                  value: "REN",
                },
              ],
            },
          ],
        },
        {
          type: CommandOptionType.SUB_COMMAND,
          name: "choose-token",
          description:
            "A poll with multiple token options to buy with a specific amount of WETH.",
          options: [
            {
              type: CommandOptionType.INTEGER,
              name: "duration",
              description: "The duration of the poll (in minutes).",
              required: true,
            },
          ],
        },
      ],
    });
    this.filePath = __filename;
  }

  async run(ctx) {
    try {
      const res = await invokePollStartLambda();
      ctx.send("The poll creation has been requested.", {
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

function invokePollStartLambda() {
  return new Promise((resolve, reject) => {
    const params = {
      FunctionName: "discord-poll-start",
      InvokeArgs: JSON.stringify({
        channelID: envVariables.DISCORD_CHANNEL_ID
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


