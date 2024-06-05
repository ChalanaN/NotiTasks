export type WebhookMessage = {
    from: string,
    id: string,
    timestamp: string,
    context?: {
        from: string,
        id: string
    }
} & ({
    type: 'text',
    text: {
        body: string,
    }
} | {
    type: 'reaction',
    reaction: {
        emoji?: string,
        "message_id": string
    }
})

export type WebHookRequest = {
    object: "whatsapp_business_account",
    entry: [
        {
            id: string,
            changes: [
                {
                    value: {
                        metadata: {
                            display_phone_number: string,
                            phone_number_id: string,
                        }
                        messages: WebhookMessage[]
                    },
                    field: string
                }
            ]
        }
    ]
}