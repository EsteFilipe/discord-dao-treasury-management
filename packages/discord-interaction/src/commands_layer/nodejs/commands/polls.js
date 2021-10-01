const { EventBridge, Lambda } = require("aws-sdk");
const { v1: uuidv1 } = require("uuid");
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
const eventBridge = new EventBridge();
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
    });
    this.filePath = __filename;
  }

  async run(ctx) {
    // Reply immediately. The scheduling takes more than the timeout
    await ctx.send("The poll goes here", {
      ephemeral: true,
    });

    //const context = await ctx.fetch();

    // TODO return to somewhere to let the person who called the vote that the counting was successfully scheduled
    //await scheduleResultsCounting(context);

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


// Schedule the Lambda function which will count the results
async function scheduleResultsCounting(context) {
  const ruleName = `poll-results-rule-${uuidv1()}`;
  // Create EventBridge rule
  // This will use the default event bus
  // TODO Clean up the rule once it has ran
  const rule = await eventBridge
    .putRule({
      Name: ruleName,
      ScheduleExpression: "cron(0/1 * * * ? *)",
    })
    .promise();

  // Save time by doing the two requests at once
  await Promise.all([
    // Grant permission to this EventBridge rule to call the Lambda that counts the votes
    lambda
      .addPermission({
        Action: "lambda:InvokeFunction",
        FunctionName: envVariables.DISCORD_POLL_RESULTS_FUNCTION_ARN,
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
            Arn: envVariables.DISCORD_POLL_RESULTS_FUNCTION_ARN,
            Input: `{ "data": "${JSON.stringify(context)}" }`,
          },
        ],
      })
      .promise(),
  ]);

  return true;
}
