const Discord = require("discord.js");
const client = new Discord.Client();

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

exports.lambdaHandler = async function (event, context) {
  await waitForClient();
  await assignRole(event.discordUserID, event.publicAddress, event.roles);
  return;
};

async function assignRole(discordUserID, publicAddress, roles) {
  const guild = await client.guilds.fetch(process.env.DISCORD_SERVER_ID);
  const member = await guild.members.fetch(discordUserID);
  await member.roles.add(roles);

  await member.send(
    `Congrats sir, you're now authenticated using Ethereum! Address: ${publicAddress}`
  );
  return true;
}