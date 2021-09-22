I'm going to build a prototype of a bot to manage the treasury of a DAO through Discord. The treasury will be managed using Enzyme Finance's vaults.

The functionalities I currently have in mind are:
- Attributing a specific role to users who have invested in the DAO's fund. I will do this using the infrastructure for Ethereum Authentication through Discord that I've built for a previous hackathon.
- Polls to decide what the funds should be allocated to - the manager of the fund can start polls and the investors can vote, such that the larger the number of shares that a certain investor holds, the more weight their vote has.
- Get information on Discord about the current treasury state: balances, holder addresses, etc.
- Allowing the manager of the fund to perform other management actions through Discord, such that this management will be fully visible to all the investors on Discord, without making them have to check on-chain what happened.