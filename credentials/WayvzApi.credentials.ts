import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WayvzApi implements ICredentialType {
	name = 'wayvzApi';

	displayName = 'WAYVZ API';

	icon: Icon = { light: 'file:../icons/wayvz.svg', dark: 'file:../icons/wayvz.dark.svg' };

	documentationUrl = 'https://api.wayvzgroup.com/docs';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your WAYVZ API key. Keys starting with sk_live_ send real messages. Keys starting with sk_test_ use the sandbox, which never sends or charges.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.wayvzgroup.com',
			url: '/v1/messages',
			method: 'GET',
			qs: { limit: 1 },
		},
	};
}
