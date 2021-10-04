const { 
  SlashCommand,
  CommandOptionType,
  ApplicationCommandPermissionType 
} = require("slash-create");
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
      // Only owner and investors can call
      defaultPermission: false,
      permissions: {
        [envVariables.DISCORD_SERVER_ID]: [
          {
            type: ApplicationCommandPermissionType.ROLE,
            id: envVariables.DISCORD_OWNER_ROLE_ID,
            permission: true
          },
          {
            type: ApplicationCommandPermissionType.ROLE,
            id: envVariables.DISCORD_INVESTOR_ROLE_ID,
            permission: true
          }
        ]
      },
      //  TODO change to choices instead of having subcommands
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