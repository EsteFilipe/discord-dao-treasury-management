const { Lambda } = require("aws-sdk");
const { 
  SlashCommand,
  CommandOptionType,
  ApplicationCommandPermissionType 
} = require("slash-create");
const fs = require("fs");

const file = fs.readFileSync("/tmp/.env");
const envVariables = JSON.parse(file);
const lambda = new Lambda();

module.exports = class TreasuryInfoCommand extends SlashCommand {
  constructor(creator) {
    super(creator, {
      name: "treasury-info",
      description: "🏛️ Get information from the treasury.",
      guildIDs: [envVariables.DISCORD_SERVER_ID],
      // Only owner and investors can call
      defaultPermission: false,
      permissions: {
        [envVariables.DISCORD_SERVER_ID]: [
          {
            type: ApplicationCommandPermissionType.ROLE,
            id: envVariables.DISCORD_OWNER_ROLE_ID,
            permission: true,
          },
          {
            type: ApplicationCommandPermissionType.ROLE,
            id: envVariables.DISCORD_INVESTOR_ROLE_ID,
            permission: true,
          },
        ],
      },
      //  TODO change to choices instead of having subcommands
      options: [
        {
          type: CommandOptionType.STRING,
          name: "field",
          description: "What do you want info about?",
          required: true,
          choices: [
            {
              name: "vault-address",
              value: "vault-address",
            },
            {
              name: "investors-share-balances",
              value: "investors-share-balances",
            },
          ],
        },
      ],
    });
    this.filePath = __filename;
  }

  async run(ctx) {
    // Note: calling another lambda to fullfil the command is certainly not ideal, but I'm doing it because I have to
    // return a reply to the slash command in less than 3 seconds, otherwise it times out. I'd be able to defer it if
    // defer() worked for lambda, but it doesn't https://github.com/Snazzah/slash-create/issues/127
    // In the future, either:
    // - Figure out why defer doesn't work in slash-create for lambda and fix it
    // - Ditch lambda for slash commands and use EC2 instead as a server (slash-create would work there, or 
    // could just use Discord.js v13 for the slash commands)
    // - Wait for nodejs 16 to be available for lambda and use Discord.js v13 instead of slash-create

    await invokeTreasuryInfoLambda(ctx.options.field)

    ctx.send(`Request successful. Params: ${JSON.stringify(ctx.options)}`, {
      ephemeral: true,
    });
  }
};

function invokeTreasuryInfoLambda(field) {
  return new Promise((resolve, reject) => {
    const params = {
      FunctionName: "discord-treasury-info",
      InvokeArgs: JSON.stringify({
        channelID: envVariables.DISCORD_CHANNEL_ID,
        field,
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