import {
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	IDataObject,
	IHookFunctions,
	INodeCredentialTestResult,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData
} from 'n8n-workflow';

import { twitchApiRequest } from './GenericFunctions.js';

export class TwitchTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Twitch Trigger',
		name: 'twitchTrigger',
		icon: 'file:twitch.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Handle Twitch events via webhooks',
		defaults: {
			name: 'Twitch Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'twitchApi',
				required: true,
				testedBy: 'testTwitchAuth',
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				required: true,
				default: 'stream.online',
                                options: [
                                        {
                                                name: 'Channel Chat Message',
                                                value: 'channel.chat.message',
                                        },
                                        {
                                                name: 'Channel Follow',
                                                value: 'channel.follow',
                                        },
                                        {
                                                name: 'Channel Raid',
                                                value: 'channel.raid',
                                        },
                                        {
                                                name: 'Channel Update',
                                                value: 'channel.update',
                                        },
                                        {
                                                name: 'Stream Offline',
                                                value: 'stream.offline',
                                        },
                                        {
                                                name: 'Stream Online',
                                                value: 'stream.online',
                                        },
                                ],
                        },
                        {
                                displayName: 'Channel',
                                name: 'channel_name',
                                type: 'string',
                                required: true,
                                default: '',
                        },
                        {
                                displayName: 'Bot User ID',
                                name: 'user_id',
                                type: 'string',
                                default: '',
                                required: true,
                                description: 'ID of your bot user',
                                displayOptions: {
                                        show: {
                                                event: ['channel.chat.message'],
                                        },
                                },
                        },
                ],
        };

	methods = {
		credentialTest: {
			async testTwitchAuth(
				this: ICredentialTestFunctions,
				credential: ICredentialsDecrypted,
			): Promise<INodeCredentialTestResult> {
				const credentials = credential.data;

				const optionsForAppToken = {
					headers: {
						'Content-Type': 'application/json',
					},
					method: 'POST',
					qs: {
						client_id: credentials!.clientId,
						client_secret: credentials!.clientSecret,
						grant_type: 'client_credentials',
					},
					uri: 'https://id.twitch.tv/oauth2/token',
					json: true,
				};

				try {
					const response = await this.helpers.request(optionsForAppToken);
					if (!response.access_token) {
						return {
							status: 'Error',
							message: 'AccessToken not received',
						};
					}
				} catch (err: unknown) {
					if (err instanceof Error) {
						return {
							status: 'Error',
							message: `Error getting access token; ${err.message}`,
						};
					}
				}

				return {
					status: 'OK',
					message: 'Authentication successful!',
				};
			},
		},
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
                                const webhookData = this.getWorkflowStaticData('node');
                                const webhookUrl = this.getNodeWebhookUrl('default');
                                const event = this.getNodeParameter('event') as string;
                                const channel = this.getNodeParameter('channel_name') as string;
                                const userData = await twitchApiRequest.call(
                                        this,
                                        'GET',
                                        '/users',
                                        {},
                                        { login: channel },
                                );
                                const broadcasterId = userData.data[0].id ?? '';
                                const botId = this.getNodeParameter('user_id', '') as string;
                                const { data: webhooks } = await twitchApiRequest.call(
                                        this,
                                        'GET',
                                        '/eventsub/subscriptions',
                                );
                                for (const webhook of webhooks) {
                                        if (
                                                webhook.transport.callback === webhookUrl &&
                                                webhook.type === event &&
                                                webhook.condition.broadcaster_user_id === broadcasterId &&
                                                (event !== 'channel.chat.message' ||
                                                        webhook.condition.user_id === botId)
                                        ) {
                                                webhookData.webhookId = webhook.id;
                                                return true;
                                        }
                                }
                                return false;
                        },
			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default');
				const webhookData = this.getWorkflowStaticData('node');
				const event = this.getNodeParameter('event');
				const channel = this.getNodeParameter('channel_name') as string;
				const userData = await twitchApiRequest.call(
					this,
					'GET',
					'/users',
					{},
					{ login: channel },
				);
                                const condition: IDataObject = {
                                        broadcaster_user_id: userData.data[0].id ?? '',
                                };
                                if (event === 'channel.chat.message') {
                                        condition.user_id = this.getNodeParameter('user_id') as string;
                                }
                                const body = {
                                        type: event,
                                        version: '1',
                                        condition,
                                        transport: {
                                                method: 'webhook',
                                                callback: webhookUrl,
                                                secret: 'n8ncreatedSecret',
                                        },
                                };
				const webhook = await twitchApiRequest.call(
					this,
					'POST',
					'/eventsub/subscriptions',
					body,
				);
				webhookData.webhookId = webhook.data[0].id;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				try {
					await twitchApiRequest.call(
						this,
						'DELETE',
						'/eventsub/subscriptions',
						{},
						{ id: webhookData.webhookId },
					);
				} catch (error) {
					return false;
				}
				delete webhookData.webhookId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const bodyData = this.getBodyData() as IDataObject;
		const res = this.getResponseObject();
		const req = this.getRequestObject();

		// Check if we're getting twitch challenge request to validate the webhook that has been created.
		if (bodyData['challenge']) {
			res.status(200).send(bodyData['challenge']).end();
			return {
				noWebhookResponse: true,
			};
		}

		return {
			workflowData: [this.helpers.returnJsonArray(req.body)],
		};
	}
}
