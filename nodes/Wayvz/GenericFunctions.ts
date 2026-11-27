import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
} from 'n8n-workflow';

export const WAYVZ_BASE_URL = 'https://api.wayvzgroup.com';

/** The API returns at most this many messages per page. */
export const MAX_PAGE_SIZE = 1000;

/**
 * Builds the options for one WAYVZ API call. Kept separate from the call itself
 * so it can be unit tested without an n8n runtime.
 */
export function buildRequestOptions(
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
	headers?: IDataObject,
): IHttpRequestOptions {
	const options: IHttpRequestOptions = {
		method,
		url: `${WAYVZ_BASE_URL}${path}`,
		headers: { Accept: 'application/json', ...(headers ?? {}) },
		json: true,
	};
	if (body !== undefined) {
		options.body = body;
	}
	if (qs !== undefined && Object.keys(qs).length > 0) {
		options.qs = qs;
	}
	return options;
}

export async function wayvzApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
	headers?: IDataObject,
): Promise<IDataObject> {
	// Errors are not wrapped here: execute() turns them into a NodeApiError with the item index.
	const options = buildRequestOptions(method, path, body, qs, headers);
	return (await this.helpers.httpRequestWithAuthentication.call(
		this,
		'wayvzApi',
		options,
	)) as IDataObject;
}

/** Encodes one id for use as a path segment. */
export function pathSegment(value: string): string {
	return encodeURIComponent(String(value).trim());
}

/**
 * Turns the "To" field into a list of numbers. Accepts a single number, a list
 * separated by commas, semicolons or new lines, or an array from an expression.
 */
export function parseDestinations(to: unknown): string[] {
	const raw: unknown[] = Array.isArray(to) ? to : String(to ?? '').split(/[,;\n\r]+/);
	const seen = new Set<string>();
	const result: string[] = [];
	for (const entry of raw) {
		const value = String(entry ?? '').trim();
		if (value !== '' && !seen.has(value)) {
			seen.add(value);
			result.push(value);
		}
	}
	return result;
}

export interface SendInput {
	sender: string;
	to: unknown;
	text: string;
	options: IDataObject;
}

/** Builds the body of POST /v1/messages and POST /v1/messages/estimate. */
export function buildSendBody(input: SendInput): IDataObject {
	const destinationNumbers = parseDestinations(input.to);
	if (destinationNumbers.length === 0) {
		throw new Error('Add at least one recipient number in "To"');
	}
	const options = input.options ?? {};
	const clientReference = stringOption(options.clientReference);

	const destinations: IDataObject[] = destinationNumbers.map((number) => {
		const destination: IDataObject = { to: number };
		if (clientReference !== undefined) {
			destination.clientReference = clientReference;
		}
		return destination;
	});

	const message: IDataObject = {
		sender: input.sender.trim(),
		destinations,
		content: { text: input.text },
	};
	const callbackData = stringOption(options.callbackData);
	if (callbackData !== undefined) {
		message.callbackData = callbackData;
	}
	const notifyUrl = stringOption(options.notifyUrl);
	if (notifyUrl !== undefined) {
		message.notifyUrl = notifyUrl;
	}

	const body: IDataObject = { messages: [message] };

	const sendOptions: IDataObject = {};
	const type = stringOption(options.type);
	if (type !== undefined) {
		sendOptions.type = type;
	}
	const schedule: IDataObject = {};
	const bulkId = stringOption(options.bulkId);
	if (bulkId !== undefined) {
		schedule.bulkId = bulkId;
	}
	const sendAt = stringOption(options.sendAt);
	if (sendAt !== undefined) {
		schedule.sendAt = sendAt;
	}
	if (Object.keys(schedule).length > 0) {
		sendOptions.schedule = schedule;
	}
	if (Object.keys(sendOptions).length > 0) {
		body.options = sendOptions;
	}
	return body;
}

/** Headers for a send call: only the Idempotency-Key, and only when set. */
export function buildSendHeaders(options: IDataObject): IDataObject {
	const key = stringOption(options.idempotencyKey);
	return key === undefined ? {} : { 'Idempotency-Key': key };
}

/** Query string for GET /v1/messages, without limit and cursor. */
export function buildListQuery(filters: IDataObject): IDataObject {
	const qs: IDataObject = {};
	for (const name of ['since', 'until', 'bulkId', 'to']) {
		const value = stringOption(filters[name]);
		if (value !== undefined) {
			qs[name] = value;
		}
	}
	const status = filters.status;
	if (Array.isArray(status) && status.length > 0) {
		qs.status = status.join(',');
	} else {
		const single = stringOption(status);
		if (single !== undefined) {
			qs.status = single;
		}
	}
	return qs;
}

export type PageFetcher = (qs: IDataObject) => Promise<IDataObject>;

/**
 * Walks GET /v1/messages with cursor pagination. Stops when nextCursor is null,
 * when a page comes back empty, or when the limit is reached. A limit of
 * undefined means return all.
 */
export async function fetchMessagePages(
	fetchPage: PageFetcher,
	baseQuery: IDataObject,
	limit?: number,
): Promise<IDataObject[]> {
	const results: IDataObject[] = [];
	let cursor: string | undefined;
	const seenCursors = new Set<string>();

	for (;;) {
		const remaining = limit === undefined ? MAX_PAGE_SIZE : limit - results.length;
		if (remaining <= 0) {
			break;
		}
		const qs: IDataObject = { ...baseQuery, limit: Math.min(remaining, MAX_PAGE_SIZE) };
		if (cursor !== undefined) {
			qs.cursor = cursor;
		}
		const page = await fetchPage(qs);
		const pageResults = Array.isArray(page.results) ? (page.results as IDataObject[]) : [];
		results.push(...pageResults);

		const next = page.nextCursor;
		if (typeof next !== 'string' || next === '' || pageResults.length === 0) {
			break;
		}
		if (seenCursors.has(next)) {
			// The API handed back a cursor it already gave: stop instead of looping forever.
			break;
		}
		seenCursors.add(next);
		cursor = next;
	}

	return limit === undefined ? results : results.slice(0, limit);
}

/** Body for POST /v1/verify. */
export function buildVerifyBody(to: string, sender: string, options: IDataObject): IDataObject {
	const body: IDataObject = { to: to.trim(), sender: sender.trim() };
	for (const name of [
		'language',
		'appName',
		'template',
		'androidAppHash',
		'webOtpDomain',
		'clientReference',
	]) {
		const value = stringOption(options[name]);
		if (value !== undefined) {
			body[name] = value;
		}
	}
	for (const name of ['codeLength', 'expiresIn']) {
		const value = options[name];
		if (typeof value === 'number' && Number.isFinite(value)) {
			body[name] = value;
		}
	}
	return body;
}

function stringOption(value: unknown): string | undefined {
	if (value === undefined || value === null) {
		return undefined;
	}
	const text = String(value).trim();
	return text === '' ? undefined : text;
}
