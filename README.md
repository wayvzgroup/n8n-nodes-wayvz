# n8n-nodes-wayvz

This is an n8n community node. It lets you use the WAYVZ SMS API in your n8n workflows.

WAYVZ sends SMS over HTTPS and tracks every message to the handset. It also sends and checks one-time codes (OTP) for phone number verification.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/n8n-community-license/) workflow automation platform.

- [Installation](#installation)
- [Credentials](#credentials)
- [Operations](#operations)
- [Usage](#usage)
- [Example workflows](#example-workflows)
- [Compatibility](#compatibility)
- [Development](#development)
- [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation. In short: in n8n open **Settings > Community Nodes**, click **Install**, enter `n8n-nodes-wayvz` and confirm.

## Credentials

You need a WAYVZ API key.

1. Sign in to your WAYVZ account and create an API key.
   - Keys starting with `sk_live_` send real messages and are charged.
   - Keys starting with `sk_test_` use the sandbox. Sandbox requests never send and never charge, so use one while you build a workflow.
2. In n8n create a new **WAYVZ API** credential and paste the key into **API Key**.
3. Click **Save**. n8n tests the key with `GET /v1/messages?limit=1`.

The key is sent as `Authorization: Bearer <key>` to `https://api.wayvzgroup.com`.

If your account restricts live keys to an IP allowlist, add the public IP address of your n8n instance, or requests fail with `403 IP_NOT_ALLOWED`.

## Operations

### Message

| Operation | API call                       | What it does                                                                                                   |
| --------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Send      | `POST /v1/messages`            | Sends one text to one or more numbers. Each number becomes its own message.                                    |
| Estimate  | `POST /v1/messages/estimate`   | Returns the encoding and the number of SMS parts. Nothing is sent or stored.                                   |
| Get       | `GET /v1/messages/{messageId}` | Status of one message, by your messageId or the wayvzMessageId.                                                |
| Get Many  | `GET /v1/messages`             | Searches messages, newest first. Supports Return All or a Limit, and filters by date, status, bulk and number. |

Send and Estimate options: **Type** (transactional or marketing), **Client Reference**, **Callback Data**, **Notify URL**, **Bulk ID**, **Send At** and, for Send only, **Idempotency Key**.

### Bulk

| Operation | API call                         | What it does                                                                        |
| --------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| Get       | `GET /v1/bulks/{bulkId}`         | Status and summary of a bulk.                                                       |
| Cancel    | `POST /v1/bulks/{bulkId}/cancel` | Cancels every message of the bulk not sent yet. Cancelled messages are not charged. |

### Verify

| Operation  | API call                                  | What it does                                                    |
| ---------- | ----------------------------------------- | --------------------------------------------------------------- |
| Send Code  | `POST /v1/verify`                         | Sends a one-time code by SMS and returns a verificationId.      |
| Check Code | `POST /v1/verify/{verificationId}/check`  | Checks the code the user entered. `valid` is true exactly once. |
| Get        | `GET /v1/verify/{verificationId}`         | The verification and the delivery status of its SMS.            |
| Cancel     | `POST /v1/verify/{verificationId}/cancel` | Cancels a pending verification.                                 |

The node can also be used as a tool by an AI Agent node.

## Usage

- **Several recipients.** Put the numbers in **To** separated by commas or new lines, or pass an array with an expression such as `{{ $json.phones }}`. Duplicates are removed. The API accepts up to 1,000 destinations per request.
- **No double sends.** Set **Idempotency Key** on Send, for example `{{ $json.orderId }}-sms`. If the workflow is retried with the same key, WAYVZ returns the first result and does not send again. The key must be 8 to 128 characters.
- **Get Many.** With **Return All** on, the node follows the API cursor (`nextCursor`) page by page until the last page. With a **Limit**, it stops as soon as it has that many messages. Each message is a separate output item.
- **Scheduling.** Set **Send At** and a **Bulk ID**. You can then cancel the whole bulk with **Bulk > Cancel** before it goes out.
- **Testing OTP.** With an `sk_test_` key, **Verify > Send Code** returns the code in `sandboxCode`, so you can test **Check Code** without a phone.
- **Errors.** API errors stop the workflow and show the HTTP status and the error returned by WAYVZ. Turn on **Continue On Fail** in the node settings to get the error as an output item instead.

## Example workflows

**Order confirmation SMS**

1. Trigger: your shop or a Webhook node receives a new order.
2. WAYVZ node: Resource **Message**, Operation **Send**. Sender `YourBrand`, To `{{ $json.customer.phone }}`, Text `Thanks {{ $json.customer.firstName }}, order {{ $json.id }} is confirmed.` Options: Type **Transactional**, Idempotency Key `{{ $json.id }}-confirm`, Client Reference `{{ $json.id }}`.

**Phone verification at sign up**

1. Webhook node receives the sign up with the phone number.
2. WAYVZ node: **Verify > Send Code**, To `{{ $json.phone }}`, Sender `YourBrand`. Store the returned `verificationId`.
3. A second Webhook receives the code the user typed.
4. WAYVZ node: **Verify > Check Code** with the stored verificationId and the code. Branch on `{{ $json.valid }}` with an If node.

**Daily failed message report**

1. Schedule Trigger, once a day.
2. WAYVZ node: **Message > Get Many**, Return All on, Filters: Status **Undeliverable** and **Rejected**, Created After `{{ $now.minus({ days: 1 }).toISO() }}`.
3. Send the list to a spreadsheet or a chat channel.

## Compatibility

Built and tested with `@n8n/node-cli` 0.58.7 and `n8n-workflow` 2.49.5. Uses the n8n Nodes API version 1 and only the `httpRequestWithAuthentication` helper, so it should work on any n8n 1.x or 2.x release that supports community nodes. The package has no runtime dependencies.

## Development

```bash
npm install
npm run build   # compile to dist/
npm run lint    # official n8n linter
npm test        # unit tests with mocked HTTP, no network calls
npm run dev     # start a local n8n with the node loaded
```

Releases are published from GitHub Actions with npm provenance, as n8n requires for verified nodes. See `.github/workflows/publish.yml` for the one-time npm setup, then run `npm run release`.

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
- [WAYVZ API guide](https://api.wayvzgroup.com/docs)
- [WAYVZ OpenAPI specification](https://api.wayvzgroup.com/openapi.json)
