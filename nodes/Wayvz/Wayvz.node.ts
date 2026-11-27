import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { bulkFields, bulkOperations } from './descriptions/BulkDescription';
import { messageFields, messageOperations } from './descriptions/MessageDescription';
import { verifyFields, verifyOperations } from './descriptions/VerifyDescription';
import {
	buildListQuery,
	buildSendBody,
	buildSendHeaders,
	buildVerifyBody,
	fetchMessagePages,
	pathSegment,
	wayvzApiRequest,
} from './GenericFunctions';

export class Wayvz implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WAYVZ',
		name: 'wayvz',
		icon: { light: 'file:wayvz.svg', dark: 'file:wayvz.dark.svg' },
		group: ['output'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Send SMS, track delivery and verify phone numbers with WAYVZ',
		defaults: {
			name: 'WAYVZ',
		},
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [
			{
				name: 'wayvzApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Bulk', value: 'bulk' },
					{ name: 'Message', value: 'message' },
					{ name: 'Verify', value: 'verify' },
				],
				default: 'message',
			},
			...messageOperations,
			...messageFields,
			...bulkOperations,
			...bulkFields,
			...verifyOperations,
			...verifyFields,
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				let responseData: IDataObject | IDataObject[];

				if (resource === 'message') {
					responseData = await executeMessage.call(this, operation, i);
				} else if (resource === 'bulk') {
					const bulkId = pathSegment(this.getNodeParameter('bulkId', i) as string);
					if (operation === 'get') {
						responseData = await wayvzApiRequest.call(this, 'GET', `/v1/bulks/${bulkId}`);
					} else if (operation === 'cancel') {
						responseData = await wayvzApiRequest.call(this, 'POST', `/v1/bulks/${bulkId}/cancel`);
					} else {
						throw unknownOperation(this, operation, resource, i);
					}
				} else if (resource === 'verify') {
					responseData = await executeVerify.call(this, operation, i);
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown resource: ${resource}`, {
						itemIndex: i,
					});
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);
				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				if (error instanceof NodeOperationError) {
					throw new NodeOperationError(this.getNode(), error, { itemIndex: i });
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function executeMessage(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	if (operation === 'send' || operation === 'estimate') {
		const options = this.getNodeParameter('options', i, {}) as IDataObject;
		let body: IDataObject;
		try {
			body = buildSendBody({
				sender: this.getNodeParameter('sender', i) as string,
				to: this.getNodeParameter('to', i),
				text: this.getNodeParameter('text', i) as string,
				options,
			});
		} catch (error) {
			throw new NodeOperationError(this.getNode(), (error as Error).message, { itemIndex: i });
		}
		if (operation === 'send') {
			return await wayvzApiRequest.call(
				this,
				'POST',
				'/v1/messages',
				body,
				undefined,
				buildSendHeaders(options),
			);
		}
		return await wayvzApiRequest.call(this, 'POST', '/v1/messages/estimate', body);
	}

	if (operation === 'get') {
		const messageId = pathSegment(this.getNodeParameter('messageId', i) as string);
		return await wayvzApiRequest.call(this, 'GET', `/v1/messages/${messageId}`);
	}

	if (operation === 'getAll') {
		const returnAll = this.getNodeParameter('returnAll', i) as boolean;
		const limit = returnAll ? undefined : (this.getNodeParameter('limit', i) as number);
		const filters = this.getNodeParameter('filters', i, {}) as IDataObject;
		return await fetchMessagePages(
			async (qs) => await wayvzApiRequest.call(this, 'GET', '/v1/messages', undefined, qs),
			buildListQuery(filters),
			limit,
		);
	}

	throw unknownOperation(this, operation, 'message', i);
}

async function executeVerify(
	this: IExecuteFunctions,
	operation: string,
	i: number,
): Promise<IDataObject> {
	if (operation === 'sendCode') {
		const body = buildVerifyBody(
			this.getNodeParameter('to', i) as string,
			this.getNodeParameter('sender', i) as string,
			this.getNodeParameter('verifyOptions', i, {}) as IDataObject,
		);
		return await wayvzApiRequest.call(this, 'POST', '/v1/verify', body);
	}

	const verificationId = pathSegment(this.getNodeParameter('verificationId', i) as string);

	if (operation === 'checkCode') {
		const code = String(this.getNodeParameter('code', i)).trim();
		return await wayvzApiRequest.call(this, 'POST', `/v1/verify/${verificationId}/check`, {
			code,
		});
	}
	if (operation === 'get') {
		return await wayvzApiRequest.call(this, 'GET', `/v1/verify/${verificationId}`);
	}
	if (operation === 'cancel') {
		return await wayvzApiRequest.call(this, 'POST', `/v1/verify/${verificationId}/cancel`);
	}

	throw unknownOperation(this, operation, 'verify', i);
}

function unknownOperation(
	context: IExecuteFunctions,
	operation: string,
	resource: string,
	itemIndex: number,
): NodeOperationError {
	return new NodeOperationError(
		context.getNode(),
		`The operation "${operation}" is not supported for resource "${resource}"`,
		{ itemIndex },
	);
}
