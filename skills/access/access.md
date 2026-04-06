---
name: access
description: Manage LINE channel access control - pairing, allowlist, and policy
args: <subcommand> [arguments]
---

# LINE Access Control

Manage who can interact with Claude Code through LINE.

## Commands

### Pair with a LINE user

When a LINE user sends their first message, they receive a pairing code.
Enter it here to authorize them:

```bash
# Read the pairing code from LINE and enter it:
# The access-control module will verify and add the user
```

To pair, the agent should call the access control's `verifyPairing` method with the code provided.

### Check access policy

Current access mode and allowed users can be viewed via the access.json file:

```bash
cat ~/.claude/channels/line/access.json
```

### Change access mode

Edit access.json to change the mode field:
- `"pairing"` - Accept new pairing requests
- `"allowlist"` - Only allow paired users (default after first pairing)
- `"disabled"` - Block all LINE messages

### Remove a user

Edit access.json and remove the user entry from the `allowed_users` array.
