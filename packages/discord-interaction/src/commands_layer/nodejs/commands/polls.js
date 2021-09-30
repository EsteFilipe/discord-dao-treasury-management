const { EventBridge } = require("aws-sdk");
const {
  SlashCommand,
  ApplicationCommandPermissionType,
  ComponentType,
  ButtonStyle,
} = require("slash-create");
const fs = require("fs");
const axios = require("axios");

const file = fs.readFileSync("/tmp/.env");
const envVariables = JSON.parse(file);
//const eventBridge = new EventBridge();

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
    });
    this.filePath = __filename;
  }

  async run(ctx) {
    ctx.send(envVariables.DISCORD_POLL_RESULTS_FUNCTION, {
      ephemeral: true,
    });
    /*
    await ctx.send("here is some buttons", {
      components: [
        {
          type: ComponentType.ACTION_ROW,
          components: [
            {
              type: ComponentType.BUTTON,
              style: ButtonStyle.PRIMARY,
              label: "button",
              custom_id: "example_button",
              emoji: {
                name: "👌",
              },
            },
          ],
        },
      ],
    });
    */
  }
};

/*
// Schedule the lambda function which will count the results
async function scheduleResultsCounting() {
  const ruleParams = {
    Name: "CountPollResultsRule",
    ScheduleExpression: "cron(0/30 * * * ? *)",
  };

  const rule = await eventBridge.putRule(ruleParams).promise();
}
*/
