import type { INodeProperties } from 'n8n-workflow';

const showForMessage = { resource: ['message'] };
const showForSendOrEstimate = { resource: ['message'], operation: ['send', 'estimate'] };
const showForGetMany = { resource: ['message'], operation: ['getAll'] };

export const messageOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: showForMessage },
		options: [
			{
				name: 'Estimate',
				value: 'estimate',
				description: 'Count the SMS parts a message would use, without sending or storing it',
				action: 'Estimate message parts',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the status of one message',
				action: 'Get a message',
			},
			{
				name: 'Get Many',
				value: 'getAll',
				description: 'Search messages, newest first',
				action: 'Get many messages',
			},
			{
				name: 'Send',
				value: 'send',
				description: 'Send an SMS to one or more numbers',
				action: 'Send a message',
			},
		],
		default: 'send',
	},
];

export const messageFields: INodeProperties[] = [
	// Send and Estimate
	{
		displayName: 'Sender',
		name: 'sender',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'WAYVZ',
		description: 'Sender ID: up to 11 letters or digits, or a number of up to 15 digits',
		displayOptions: { show: showForSendOrEstimate },
	},
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: '+971501234567, +966501234567',
		description:
			'One or more numbers in international format, separated by commas or new lines. Each number becomes its own message.',
		displayOptions: { show: showForSendOrEstimate },
	},
	{
		displayName: 'Text',
		name: 'text',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { rows: 4 },
		description: 'Message text, up to 1,600 characters (10 SMS parts)',
		displayOptions: { show: showForSendOrEstimate },
	},
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: showForSendOrEstimate },
		options: [
			{
				displayName: 'Bulk ID',
				name: 'bulkId',
				type: 'string',
				default: '',
				description:
					'Your own ID for this request, unique per account. Use it later with the Bulk resource.',
			},
			{
				displayName: 'Callback Data',
				name: 'callbackData',
				type: 'string',
				default: '',
				description: 'Returned unchanged in lookups, delivery reports and webhooks',
			},
			{
				displayName: 'Client Reference',
				name: 'clientReference',
				type: 'string',
				default: '',
				description: 'Your own reference, stored on every message of this request',
			},
			{
				displayName: 'Idempotency Key',
				name: 'idempotencyKey',
				type: 'string',
				default: '',
				description:
					'8 to 128 characters. Repeating a send with the same key never sends twice. Only used by Send.',
			},
			{
				displayName: 'Notify URL',
				name: 'notifyUrl',
				type: 'string',
				default: '',
				placeholder: 'https://example.com/wayvz/delivery',
				description: 'Public HTTPS URL that receives the delivery report',
			},
			{
				displayName: 'Send At',
				name: 'sendAt',
				type: 'dateTime',
				default: '',
				description: 'Schedule the message for later, up to 180 days ahead',
			},
			{
				displayName: 'Type',
				name: 'type',
				type: 'options',
				options: [
					{ name: 'Marketing', value: 'marketing' },
					{ name: 'Transactional', value: 'transactional' },
				],
				default: 'transactional',
				description: 'Whether the message is transactional or marketing',
			},
		],
	},

	// Get
	{
		displayName: 'Message ID',
		name: 'messageId',
		type: 'string',
		required: true,
		default: '',
		description: 'Your messageId or the wayvzMessageId',
		displayOptions: { show: { resource: ['message'], operation: ['get'] } },
	},

	// Get Many
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		description: 'Whether to return all results or only up to a given limit',
		displayOptions: { show: showForGetMany },
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		description: 'Max number of results to return',
		displayOptions: { show: { ...showForGetMany, returnAll: [false] } },
	},
	{
		displayName: 'Filters',
		name: 'filters',
		type: 'collection',
		placeholder: 'Add Filter',
		default: {},
		displayOptions: { show: showForGetMany },
		options: [
			{
				displayName: 'Bulk ID',
				name: 'bulkId',
				type: 'string',
				default: '',
				description: 'Your bulkId or the wayvzBulkId',
			},
			{
				displayName: 'Created After',
				name: 'since',
				type: 'dateTime',
				default: '',
				description: 'Only messages created at or after this time (UTC)',
			},
			{
				displayName: 'Created Before',
				name: 'until',
				type: 'dateTime',
				default: '',
				description: 'Only messages created before this time (UTC)',
			},
			{
				displayName: 'Status',
				name: 'status',
				type: 'multiOptions',
				options: [
					{ name: 'Delivered', value: 'DELIVERED' },
					{ name: 'Expired', value: 'EXPIRED' },
					{ name: 'Pending', value: 'PENDING' },
					{ name: 'Rejected', value: 'REJECTED' },
					{ name: 'Undeliverable', value: 'UNDELIVERABLE' },
				],
				default: [],
				description: 'Only messages in these status groups',
			},
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				default: '',
				description: 'Only messages sent to this number',
			},
		],
	},
];
