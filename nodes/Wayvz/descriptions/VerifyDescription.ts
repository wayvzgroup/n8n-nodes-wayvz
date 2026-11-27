import type { INodeProperties } from 'n8n-workflow';

export const verifyOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['verify'] } },
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				description: 'Cancel a pending verification',
				action: 'Cancel a verification',
			},
			{
				name: 'Check Code',
				value: 'checkCode',
				description: 'Check the code the user entered',
				action: 'Check a verification code',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get a verification and the delivery status of its SMS',
				action: 'Get a verification',
			},
			{
				name: 'Send Code',
				value: 'sendCode',
				description: 'Send a one-time code by SMS',
				action: 'Send a verification code',
			},
		],
		default: 'sendCode',
	},
];

export const verifyFields: INodeProperties[] = [
	// Send Code
	{
		displayName: 'To',
		name: 'to',
		type: 'string',
		required: true,
		default: '',
		placeholder: '966501234567',
		description: 'Mobile number in international format',
		displayOptions: { show: { resource: ['verify'], operation: ['sendCode'] } },
	},
	{
		displayName: 'Sender',
		name: 'sender',
		type: 'string',
		required: true,
		default: '',
		placeholder: 'WAYVZ',
		description: 'Your registered sender name',
		displayOptions: { show: { resource: ['verify'], operation: ['sendCode'] } },
	},
	{
		displayName: 'Options',
		name: 'verifyOptions',
		type: 'collection',
		placeholder: 'Add Option',
		default: {},
		displayOptions: { show: { resource: ['verify'], operation: ['sendCode'] } },
		options: [
			{
				displayName: 'Android App Hash',
				name: 'androidAppHash',
				type: 'string',
				default: '',
				description: 'Android SMS Retriever: the 11 character app hash, added as the last line',
			},
			{
				displayName: 'App Name',
				name: 'appName',
				type: 'string',
				default: '',
				description: 'Shown in the default text, up to 40 characters',
			},
			{
				displayName: 'Client Reference',
				name: 'clientReference',
				type: 'string',
				default: '',
				description: 'Your own reference for this verification',
			},
			{
				displayName: 'Code Length',
				name: 'codeLength',
				type: 'number',
				typeOptions: { minValue: 4, maxValue: 10 },
				default: 6,
				description: 'Number of digits in the code',
			},
			{
				displayName: 'Expires In (Seconds)',
				name: 'expiresIn',
				type: 'number',
				typeOptions: { minValue: 60, maxValue: 1800 },
				default: 300,
				description: 'How long the code stays valid',
			},
			{
				displayName: 'Language',
				name: 'language',
				type: 'options',
				options: [
					{ name: 'Arabic', value: 'ar' },
					{ name: 'English', value: 'en' },
				],
				default: 'en',
				description: 'Language of the default text',
			},
			{
				displayName: 'Template',
				name: 'template',
				type: 'string',
				default: '',
				placeholder: 'Your {app} code is {code}. It expires in {minutes} minutes.',
				description: 'Your own text. Must contain {code}. May use {minutes} and {app}.',
			},
			{
				displayName: 'Web OTP Domain',
				name: 'webOtpDomain',
				type: 'string',
				default: '',
				placeholder: 'example.com',
				description: 'Web OTP: adds "@domain #code" as the last line',
			},
		],
	},

	// Check Code, Get, Cancel
	{
		displayName: 'Verification ID',
		name: 'verificationId',
		type: 'string',
		required: true,
		default: '',
		description: 'The verificationId returned by Send Code',
		displayOptions: { show: { resource: ['verify'], operation: ['checkCode', 'get', 'cancel'] } },
	},
	{
		displayName: 'Code',
		name: 'code',
		type: 'string',
		required: true,
		default: '',
		placeholder: '482913',
		description: 'The 4 to 10 digit code the user entered',
		displayOptions: { show: { resource: ['verify'], operation: ['checkCode'] } },
	},
];
