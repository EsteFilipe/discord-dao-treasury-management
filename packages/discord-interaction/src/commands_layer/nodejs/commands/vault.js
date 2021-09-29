// TODO make these commands only accessible to roled users

const { SlashCommand, CommandOptionType } = require("slash-create");
const fs = require("fs");
const axios = require("axios");

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
          type: CommandOptionType.SUB_COMMAND,
          name: "owner",
          description: "The address of the vault's owner.",
        },
      ],
    });
    this.filePath = __filename;
  }

  async run(ctx) {
    var result;
    if (ctx.options.owner) {
      const response = await callEnzymeApi("/vault-info", `field=owner&vaultAddress=${envVariables.VAULT_ADDRESS}`);
      result = response.data.address ? response.data.address : "ERROR";
    }
    ctx.send(result, {
      ephemeral: true,
    });
  }
};

function callEnzymeApi(path, arguments) {
  // `arguments` is a string in the form 'arg1=foo&arg2=bar' 
  const url = envVariables.ENZYME_API_ENDPOINT + `${path}?${arguments}`
  return axios.get(url)
}