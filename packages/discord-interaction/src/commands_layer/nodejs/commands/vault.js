// TODO make these commands only accessible to roled users

const { SlashCommand, CommandOptionType } = require("slash-create");
const fs = require("fs");

const file = fs.readFileSync("/tmp/.env");
const envVariables = JSON.parse(file);

module.exports = class VaultCommand extends SlashCommand {
  constructor(creator) {
    super(creator, {
      name: "vault",
      description: "Get information from the vault.",
      guildIDs: [envVariables.DISCORD_SERVER_ID],
      options: [
        {
          type: CommandOptionType.STRING,
          name: "food",
          description: "What food do you like?",
        },
      ]
    });
    this.filePath = __filename;
  }

  async run(ctx) {
    ctx.send(ctx.options.food, {
      ephemeral: true,
    });
  }
};