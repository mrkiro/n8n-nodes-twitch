import {
    IDataObject,
    IExecuteFunctions,
    INodeType,
    INodeTypeDescription,
} from 'n8n-workflow';

import { sendChatMessage, twitchApiRequest } from './GenericFunctions.js';

export class Twitch implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'Twitch',
        name: 'twitch',
        icon: 'file:twitch.svg',
        group: ['transform'],
        version: 1,
        description: 'Interact with Twitch',
        defaults: {
            name: 'Twitch',
        },
        inputs: ['main'],
        outputs: ['main'],
        credentials: [
            {
                name: 'twitchApi',
                required: true,
            },
        ],
        properties: [
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                default: 'getChannelStreams',
                options: [
                    {
                        name: 'Get Channel Streams',
                        value: 'getChannelStreams',
                        action: 'Get channel streams',
                    },
                    {
                        name: 'Get Game Details',
                        value: 'getGameDetails',
                        action: 'Get game details',
                    },
                    {
                        name: 'Get Top Games',
                        value: 'getTopGames',
                        action: 'Get top games',
                    },
                    {
                        name: 'Search Categories',
                        value: 'searchCategories',
                        action: 'Search categories',
                    },
                    {
                        name: 'Search Channels',
                        value: 'searchChannels',
                        action: 'Search channels',
                    },
                    {
                        name: 'Send Chat Message',
                        value: 'sendChatMessage',
                        action: 'Send chat message',
                    },
                ],
            },
            {
                displayName: 'Channel Name',
                name: 'channel_name',
                type: 'string',
                required: true,
                default: '',
                description: 'Name of the channel whose streams to retrieve',
                displayOptions: {
                    show: {
                        operation: ['getChannelStreams'],
                    },
                },
            },
            {
                displayName: 'Query',
                name: 'query',
                type: 'string',
                required: true,
                default: '',
                description: 'Search query',
                displayOptions: {
                    show: {
                        operation: ['searchChannels', 'searchCategories'],
                    },
                },
            },
            {
                displayName: 'Game Name',
                name: 'game_name',
                type: 'string',
                required: true,
                default: '',
                description: 'Name of the game',
                displayOptions: {
                    show: {
                        operation: ['getGameDetails'],
                    },
                },
            },
            {
                displayName: 'Limit',
                name: 'limit',
                type: 'number',
                typeOptions: { minValue: 1 },
                default: 50,
                description: 'Max number of results to return',
                displayOptions: {
                    show: {
                        operation: ['getTopGames'],
                    },
                },
            },
            {
                displayName: 'Broadcaster ID',
                name: 'broadcaster_id',
                type: 'string',
                required: true,
                default: '',
                description: 'ID of the broadcaster',
                displayOptions: {
                    show: {
                        operation: ['sendChatMessage'],
                    },
                },
            },
            {
                displayName: 'Sender ID',
                name: 'sender_id',
                type: 'string',
                required: true,
                default: '',
                description: 'ID of the bot user sending the message',
                displayOptions: {
                    show: {
                        operation: ['sendChatMessage'],
                    },
                },
            },
            {
                displayName: 'Message',
                name: 'message',
                type: 'string',
                required: true,
                default: '',
                description: 'Message to send',
                displayOptions: {
                    show: {
                        operation: ['sendChatMessage'],
                    },
                },
            },
            {
                displayName: 'Reply To Message ID',
                name: 'reply_parent_message_id',
                type: 'string',
                default: '',
                description: 'ID of the message to reply to',
                displayOptions: {
                    show: {
                        operation: ['sendChatMessage'],
                    },
                },
            },
        ],
    };

    async execute(this: IExecuteFunctions) {
        const items = this.getInputData();
        const returnData: IDataObject[] = [];

        for (let i = 0; i < items.length; i++) {
            const operation = this.getNodeParameter('operation', i) as string;

            if (operation === 'getChannelStreams') {
                const channelName = this.getNodeParameter('channel_name', i) as string;

                const response = await twitchApiRequest.call(
                    this,
                    'GET',
                    '/streams',
                    {},
                    { user_login: channelName },
                );

                if (Array.isArray(response.data)) {
                    returnData.push(...response.data);
                }
            }

            if (operation === 'searchChannels') {
                const query = this.getNodeParameter('query', i) as string;
                const response = await twitchApiRequest.call(
                    this,
                    'GET',
                    '/search/channels',
                    {},
                    { query },
                );
                if (Array.isArray(response.data)) {
                    returnData.push(...response.data);
                }
            }

            if (operation === 'searchCategories') {
                const query = this.getNodeParameter('query', i) as string;
                const response = await twitchApiRequest.call(
                    this,
                    'GET',
                    '/search/categories',
                    {},
                    { query },
                );
                if (Array.isArray(response.data)) {
                    returnData.push(...response.data);
                }
            }

            if (operation === 'getGameDetails') {
                const gameName = this.getNodeParameter('game_name', i) as string;
                const response = await twitchApiRequest.call(
                    this,
                    'GET',
                    '/games',
                    {},
                    { name: gameName },
                );
                if (Array.isArray(response.data)) {
                    returnData.push(...response.data);
                }
            }

            if (operation === 'getTopGames') {
                const limit = this.getNodeParameter('limit', i) as number;
                const response = await twitchApiRequest.call(
                    this,
                    'GET',
                    '/games/top',
                    {},
                    { first: limit },
                );
                if (Array.isArray(response.data)) {
                    returnData.push(...response.data);
                }
            }

            if (operation === 'sendChatMessage') {
                const broadcasterId = this.getNodeParameter('broadcaster_id', i) as string;
                const senderId = this.getNodeParameter('sender_id', i) as string;
                const message = this.getNodeParameter('message', i) as string;
                const replyParentMessageId = this.getNodeParameter(
                    'reply_parent_message_id',
                    i,
                    '',
                ) as string;
                const response = await sendChatMessage.call(
                    this,
                    broadcasterId,
                    senderId,
                    message,
                    replyParentMessageId || undefined,
                );
                returnData.push(response);
            }
        }

        return [this.helpers.returnJsonArray(returnData)];
    }
}
