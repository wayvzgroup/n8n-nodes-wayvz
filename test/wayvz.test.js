'use strict';

// Unit tests for the WAYVZ node. They run against the compiled output in dist/
// with Node's built-in test runner, so they add no dependency of any kind.
// Every HTTP call goes to a mocked httpRequestWithAuthentication; nothing
// reaches the network.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { Wayvz } = require('../dist/nodes/Wayvz/Wayvz.node.js');
const { WayvzApi } = require('../dist/credentials/WayvzApi.credentials.js');
const {
	buildRequestOptions,
	buildSendBody,
	buildSendHeaders,
	buildListQuery,
	buildVerifyBody,
	fetchMessagePages,
	parseDestinations,
	pathSegment,
	MAX_PAGE_SIZE,
} = require('../dist/nodes/Wayvz/GenericFunctions.js');

/**
 * A minimal stand-in for n8n's IExecuteFunctions. `params` holds the node
 * parameters; `responder` answers each request and every call is recorded.
 */
function createContext(params, responder, { continueOnFail = false } = {}) {
	const calls = [];
	const context = {
		calls,
		getInputData: () => [{ json: {} }],
		getNodeParameter: (name, _index, fallback) => {
			if (Object.prototype.hasOwnProperty.call(params, name)) return params[name];
			if (fallback !== undefined) return fallback;
			throw new Error(`Missing test parameter: ${name}`);
		},
		getNode: () => ({
			name: 'WAYVZ',
			type: 'n8n-nodes-wayvz.wayvz',
			typeVersion: 1,
			parameters: {},
		}),
		continueOnFail: () => continueOnFail,
		helpers: {
			httpRequestWithAuthentication: async function (credentialType, options) {
				calls.push({ credentialType, options });
				return responder(options, calls.length);
			},
			returnJsonArray: (data) => (Array.isArray(data) ? data : [data]).map((json) => ({ json })),
			constructExecutionMetaData: (items, { itemData }) =>
				items.map((item) => ({ ...item, pairedItem: itemData })),
		},
	};
	return context;
}

async function run(params, responder, options) {
	const node = new Wayvz();
	const context = createContext(params, responder, options);
	const output = await node.execute.call(context);
	return { output: output[0], calls: context.calls };
}

// ---------------------------------------------------------------- credential

test('credential sends the key as a Bearer token and tests GET /v1/messages?limit=1', () => {
	const credential = new WayvzApi();
	assert.equal(credential.name, 'wayvzApi');
	assert.equal(
		credential.authenticate.properties.headers.Authorization,
		'=Bearer {{$credentials.apiKey}}',
	);
	assert.equal(credential.test.request.baseURL, 'https://api.wayvzgroup.com');
	assert.equal(credential.test.request.url, '/v1/messages');
	assert.equal(credential.test.request.method, 'GET');
	assert.deepEqual(credential.test.request.qs, { limit: 1 });
	assert.equal(credential.properties[0].typeOptions.password, true);
});

test('node is usable as a tool and uses the wayvzApi credential', () => {
	const { description } = new Wayvz();
	assert.equal(description.usableAsTool, true);
	assert.deepEqual(
		description.credentials.map((c) => c.name),
		['wayvzApi'],
	);
});

// ---------------------------------------------------------------- pure helpers

test('parseDestinations splits on commas, semicolons and new lines, trims and removes duplicates', () => {
	assert.deepEqual(parseDestinations(' +971501234567, 966501234567;\n+971501234567\n\n'), [
		'+971501234567',
		'966501234567',
	]);
	assert.deepEqual(parseDestinations(['+1', ' +2 ', '']), ['+1', '+2']);
	assert.deepEqual(parseDestinations(''), []);
	assert.deepEqual(parseDestinations(undefined), []);
});

test('buildSendBody maps fields to the OpenAPI SendRequest shape', () => {
	const body = buildSendBody({
		sender: ' WAYVZ ',
		to: '+971501234567,+966501234567',
		text: 'Hello {{name}}',
		options: {
			type: 'marketing',
			clientReference: 'order-42',
			callbackData: 'cb',
			notifyUrl: 'https://example.com/dlr',
			bulkId: 'bulk-1',
			sendAt: '2026-12-01T10:00:00.000Z',
			idempotencyKey: 'should-not-be-in-body',
		},
	});
	assert.deepEqual(body, {
		messages: [
			{
				sender: 'WAYVZ',
				destinations: [
					{ to: '+971501234567', clientReference: 'order-42' },
					{ to: '+966501234567', clientReference: 'order-42' },
				],
				content: { text: 'Hello {{name}}' },
				callbackData: 'cb',
				notifyUrl: 'https://example.com/dlr',
			},
		],
		options: {
			type: 'marketing',
			schedule: { bulkId: 'bulk-1', sendAt: '2026-12-01T10:00:00.000Z' },
		},
	});
});

test('buildSendBody leaves out empty options and keeps the text unchanged', () => {
	const body = buildSendBody({
		sender: 'WAYVZ',
		to: '+971501234567',
		text: '  spaced  ',
		options: {},
	});
	assert.deepEqual(body, {
		messages: [
			{ sender: 'WAYVZ', destinations: [{ to: '+971501234567' }], content: { text: '  spaced  ' } },
		],
	});
});

test('buildSendBody refuses an empty recipient list', () => {
	assert.throws(
		() => buildSendBody({ sender: 'WAYVZ', to: ' , ', text: 'x', options: {} }),
		/recipient/,
	);
});

test('buildSendHeaders adds Idempotency-Key only when set', () => {
	assert.deepEqual(buildSendHeaders({}), {});
	assert.deepEqual(buildSendHeaders({ idempotencyKey: '  ' }), {});
	assert.deepEqual(buildSendHeaders({ idempotencyKey: 'order-42-send' }), {
		'Idempotency-Key': 'order-42-send',
	});
});

test('buildListQuery joins status groups and skips empty filters', () => {
	assert.deepEqual(
		buildListQuery({
			status: ['UNDELIVERABLE', 'REJECTED'],
			bulkId: 'b1',
			to: '',
			since: '2026-01-01T00:00:00Z',
		}),
		{ since: '2026-01-01T00:00:00Z', bulkId: 'b1', status: 'UNDELIVERABLE,REJECTED' },
	);
	assert.deepEqual(buildListQuery({ status: [] }), {});
});

test('buildVerifyBody keeps only set options', () => {
	assert.deepEqual(
		buildVerifyBody(' 966501234567 ', 'WAYVZ', {
			language: 'ar',
			codeLength: 4,
			appName: '',
			expiresIn: 600,
		}),
		{ to: '966501234567', sender: 'WAYVZ', language: 'ar', codeLength: 4, expiresIn: 600 },
	);
});

test('buildRequestOptions targets the WAYVZ base URL with JSON', () => {
	const options = buildRequestOptions('GET', '/v1/messages', undefined, { limit: 1 }, { X: 'y' });
	assert.deepEqual(options, {
		method: 'GET',
		url: 'https://api.wayvzgroup.com/v1/messages',
		headers: { Accept: 'application/json', X: 'y' },
		json: true,
		qs: { limit: 1 },
	});
	assert.equal(buildRequestOptions('POST', '/v1/verify', {}, {}).qs, undefined);
});

test('pathSegment encodes ids so they cannot change the path', () => {
	assert.equal(pathSegment(' a/b?c '), 'a%2Fb%3Fc');
});

// ---------------------------------------------------------------- pagination

function pager(pages) {
	const seen = [];
	const fetchPage = async (qs) => {
		seen.push({ ...qs });
		const page = pages[seen.length - 1];
		if (!page) throw new Error('Requested more pages than exist');
		return page;
	};
	return { fetchPage, seen };
}

const msgs = (from, count) =>
	Array.from({ length: count }, (_, k) => ({ messageId: `m${from + k}` }));

test('return all follows nextCursor until it is null, with the largest page size', async () => {
	const { fetchPage, seen } = pager([
		{ results: msgs(0, 3), nextCursor: 'c1' },
		{ results: msgs(3, 3), nextCursor: 'c2' },
		{ results: msgs(6, 1), nextCursor: null },
	]);
	const results = await fetchMessagePages(fetchPage, { status: 'DELIVERED' });
	assert.equal(results.length, 7);
	assert.deepEqual(seen, [
		{ status: 'DELIVERED', limit: MAX_PAGE_SIZE },
		{ status: 'DELIVERED', limit: MAX_PAGE_SIZE, cursor: 'c1' },
		{ status: 'DELIVERED', limit: MAX_PAGE_SIZE, cursor: 'c2' },
	]);
});

test('a limit asks only for what is left and stops once reached', async () => {
	const { fetchPage, seen } = pager([{ results: msgs(0, 5), nextCursor: 'c1' }]);
	const results = await fetchMessagePages(fetchPage, {}, 5);
	assert.equal(results.length, 5);
	assert.deepEqual(seen, [{ limit: 5 }]);
});

test('a limit above the page size spans pages and trims the result', async () => {
	const { fetchPage, seen } = pager([
		{ results: msgs(0, 1000), nextCursor: 'c1' },
		{ results: msgs(1000, 500), nextCursor: 'c2' },
	]);
	const results = await fetchMessagePages(fetchPage, {}, 1500);
	assert.equal(results.length, 1500);
	assert.deepEqual(seen, [{ limit: 1000 }, { limit: 500, cursor: 'c1' }]);
});

test('pagination stops on an empty page or a repeated cursor', async () => {
	const empty = pager([{ results: [], nextCursor: 'c1' }]);
	assert.deepEqual(await fetchMessagePages(empty.fetchPage, {}), []);
	assert.equal(empty.seen.length, 1);

	const loop = pager([
		{ results: msgs(0, 2), nextCursor: 'same' },
		{ results: msgs(2, 2), nextCursor: 'same' },
	]);
	const results = await fetchMessagePages(loop.fetchPage, {});
	assert.equal(results.length, 4);
	assert.equal(loop.seen.length, 2);
});

// ---------------------------------------------------------------- node execute

test('Message Send posts the body with the Idempotency-Key header', async () => {
	const response = { bulkId: 'b1', messages: [{ messageId: 'm1' }] };
	const { output, calls } = await run(
		{
			resource: 'message',
			operation: 'send',
			sender: 'WAYVZ',
			to: '+971501234567',
			text: 'Hi',
			options: { idempotencyKey: 'key-12345678', type: 'transactional' },
		},
		() => response,
	);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].credentialType, 'wayvzApi');
	const { options } = calls[0];
	assert.equal(options.method, 'POST');
	assert.equal(options.url, 'https://api.wayvzgroup.com/v1/messages');
	assert.equal(options.headers['Idempotency-Key'], 'key-12345678');
	assert.deepEqual(options.body.options, { type: 'transactional' });
	assert.deepEqual(output, [{ json: response, pairedItem: { item: 0 } }]);
});

test('Message Estimate posts to /estimate without the Idempotency-Key header', async () => {
	const { calls } = await run(
		{
			resource: 'message',
			operation: 'estimate',
			sender: 'WAYVZ',
			to: '+971501234567',
			text: 'Hi',
			options: { idempotencyKey: 'key-12345678' },
		},
		() => ({ totalSmsCount: 1 }),
	);
	assert.equal(calls[0].options.url, 'https://api.wayvzgroup.com/v1/messages/estimate');
	assert.equal(calls[0].options.headers['Idempotency-Key'], undefined);
});

test('Message Get encodes the id into the path', async () => {
	const { calls } = await run(
		{ resource: 'message', operation: 'get', messageId: 'order 1' },
		() => ({}),
	);
	assert.equal(calls[0].options.method, 'GET');
	assert.equal(calls[0].options.url, 'https://api.wayvzgroup.com/v1/messages/order%201');
});

test('Message Get Many with Return All outputs one item per message across pages', async () => {
	const { output, calls } = await run(
		{ resource: 'message', operation: 'getAll', returnAll: true, filters: { status: ['PENDING'] } },
		(options, n) =>
			n === 1
				? { results: msgs(0, 2), nextCursor: 'next' }
				: { results: msgs(2, 1), nextCursor: null },
	);
	assert.equal(output.length, 3);
	assert.deepEqual(calls[0].options.qs, { status: 'PENDING', limit: 1000 });
	assert.deepEqual(calls[1].options.qs, { status: 'PENDING', limit: 1000, cursor: 'next' });
});

test('Message Get Many with a limit makes one call', async () => {
	const { output, calls } = await run(
		{ resource: 'message', operation: 'getAll', returnAll: false, limit: 2, filters: {} },
		() => ({ results: msgs(0, 2), nextCursor: 'more' }),
	);
	assert.equal(output.length, 2);
	assert.equal(calls.length, 1);
	assert.deepEqual(calls[0].options.qs, { limit: 2 });
});

test('Bulk Get and Cancel hit the bulk routes', async () => {
	const get = await run({ resource: 'bulk', operation: 'get', bulkId: 'b-1' }, () => ({}));
	assert.equal(get.calls[0].options.method, 'GET');
	assert.equal(get.calls[0].options.url, 'https://api.wayvzgroup.com/v1/bulks/b-1');

	const cancel = await run({ resource: 'bulk', operation: 'cancel', bulkId: 'b-1' }, () => ({
		cancelled: 3,
	}));
	assert.equal(cancel.calls[0].options.method, 'POST');
	assert.equal(cancel.calls[0].options.url, 'https://api.wayvzgroup.com/v1/bulks/b-1/cancel');
});

test('Verify operations hit the verify routes with the right bodies', async () => {
	const id = '0f8fad5b-d9cb-469f-a165-70867728950e';

	const send = await run(
		{
			resource: 'verify',
			operation: 'sendCode',
			to: '966501234567',
			sender: 'WAYVZ',
			verifyOptions: { language: 'en' },
		},
		() => ({ verificationId: id }),
	);
	assert.equal(send.calls[0].options.url, 'https://api.wayvzgroup.com/v1/verify');
	assert.deepEqual(send.calls[0].options.body, {
		to: '966501234567',
		sender: 'WAYVZ',
		language: 'en',
	});

	const check = await run(
		{ resource: 'verify', operation: 'checkCode', verificationId: id, code: ' 482913 ' },
		() => ({}),
	);
	assert.equal(check.calls[0].options.url, `https://api.wayvzgroup.com/v1/verify/${id}/check`);
	assert.deepEqual(check.calls[0].options.body, { code: '482913' });

	const get = await run({ resource: 'verify', operation: 'get', verificationId: id }, () => ({}));
	assert.equal(get.calls[0].options.method, 'GET');
	assert.equal(get.calls[0].options.url, `https://api.wayvzgroup.com/v1/verify/${id}`);

	const cancel = await run(
		{ resource: 'verify', operation: 'cancel', verificationId: id },
		() => ({}),
	);
	assert.equal(cancel.calls[0].options.method, 'POST');
	assert.equal(cancel.calls[0].options.url, `https://api.wayvzgroup.com/v1/verify/${id}/cancel`);
});

test('API errors surface as NodeApiError, or as an error item with Continue On Fail', async () => {
	const failing = () => {
		const error = new Error('Request failed with status code 401');
		error.httpCode = '401';
		throw error;
	};
	await assert.rejects(
		run({ resource: 'bulk', operation: 'get', bulkId: 'x' }, failing),
		(error) => error.name === 'NodeApiError',
	);

	const { output } = await run({ resource: 'bulk', operation: 'get', bulkId: 'x' }, failing, {
		continueOnFail: true,
	});
	assert.equal(output.length, 1);
	assert.ok(output[0].json.error);
});

test('an empty recipient list fails before any request is made', async () => {
	const context = createContext(
		{ resource: 'message', operation: 'send', sender: 'WAYVZ', to: ' ', text: 'x', options: {} },
		() => ({}),
	);
	await assert.rejects(
		new Wayvz().execute.call(context),
		(error) => error.name === 'NodeOperationError',
	);
	assert.equal(context.calls.length, 0);
});
