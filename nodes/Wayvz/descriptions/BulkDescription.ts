import type { INodeProperties } from 'n8n-workflow';

export const bulkOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		displayOptions: { show: { resource: ['bulk'] } },
		options: [
			{
				name: 'Cancel',
				value: 'cancel',
				description:
					'Cancel every message of a bulk that is not sent yet. Cancelled messages are not charged.',
				action: 'Cancel a bulk',
			},
			{
				name: 'Get',
				value: 'get',
				description: 'Get the status and summary of a bulk',
				action: 'Get a bulk',
			},
		],
		default: 'get',
	},
];

export const bulkFields: INodeProperties[] = [
	{
		displayName: 'Bulk ID',
		name: 'bulkId',
		type: 'string',
		required: true,
		default: '',
		description: 'Your bulkId or the wayvzBulkId',
		displayOptions: { show: { resource: ['bulk'] } },
	},
];
