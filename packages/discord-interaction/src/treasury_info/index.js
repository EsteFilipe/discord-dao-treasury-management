const axios = require("axios");
const { Client: DiscordClient, MessageEmbed } = require("discord.js");
const { getAllInvestors } = require("./models/authentication");

const ENZYME_FRONTEND_URL = "https://kovan.enzyme.finance"
const ETHERSCAN_ADDRESS_URL = "https://kovan.etherscan.io/address/";

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

exports.treasuryInfo = async function (event, context) {
  await waitForClient();

  var embed = new MessageEmbed().setColor(0x00ff00);

  if (event.field === "vault-address") {
    embed
      .setTitle("Vault address:")
      .setDescription(`${ENZYME_FRONTEND_URL}/vault/${process.env.VAULT_ADDRESS}`)
  }
  else if (event.field === "investors-share-balances") {
    embed.setTitle("Share balances of the Discord authenticated investors:");

    var investors = await getInvestorsShareBalances();

    // IMPORTANT NOTE:
    // Adding fields like this doesn't scale, as the maximum of fields in an embed is 25
    // https://discordjs.guide/popular-topics/embeds.html#editing-the-embedded-message-content
    // Just showing like this for prototype purposes
    for (const investor of investors) {
      embed.addFields({
        name: `${investor.username}`,
        value:
          `Shares owned: ${investor.shares}\n` +
          `[Public Address](${ETHERSCAN_ADDRESS_URL + investor.publicAddress})`,
      });
    }
  }

  await client.channels.cache.get(event.channelID).send(embed);

  return true;
}


async function getInvestorsShareBalances() {
  // 1. Get all the authenticated Investors
  const investors = await getAllInvestors();

  // Using map instead of forEach bc I want to await all the promises to finish
  const investorShareBalances = await Promise.all(investors.Items.map(async (investor) => {
    // Update the shares balance for each investor because it might have changed since
    // the time they authenticated the address
    const url =
      process.env.ENZYME_API_ENDPOINT +
      "/vault-info?field=shares-balance&vaultAddress=" +
      process.env.VAULT_ADDRESS +
      "&investorAddress=" +
      investor.PublicAddress;

    var returnFields = {
      username: investor.DiscordUsername,
      publicAddress: investor.PublicAddress,
    };
    var sharesUpdated;
    try {
      const response = await axios.get(url);
      if (response) {
        if (response.data.balance) {
          sharesUpdated = parseFloat(response.data.balance).toFixed(5);
        } else sharesUpdated = 0;
      } else sharesUpdated = 0;
    } catch (e) {
      return sharesUpdated = 0;
    }
    // This will be a promise since promises cascade down (from the await axios.get), and will be waited for
    returnFields.shares = sharesUpdated;
    return returnFields;
  }))

  // Sort by shares balance (array is sorted in place)
  investorShareBalances.sort(function compare(investorA, investorB) {
    if (investorA.shares < investorB.shares) {
      return 1;
    }
    if (investorA.shares > investorB.shares) {
      return -1;
    }
    return 0;
  });

  return investorShareBalances;
}