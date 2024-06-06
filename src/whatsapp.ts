import fs from "fs/promises"
import { readFileSync } from "fs"
import https from "https"
import { addTask, archiveTask, updateTask } from "./notion.js"
import parseMessage from "./parser.js"
import { TaskStatus } from "./notion.js"
import { WebHookRequest } from "./webhook.js"

const { WEBHOOK_VERIFY_TOKEN, PORT, WEBHOOK_PATHNAME, CERT_PATH } = process.env;

/**
 * `WhatsApp message id` > `Notion task id` map of the tasks created on WhatsApp
 */
export const taskMap: { [id: string]: string } = {}
const taskMapFile = "./taskmap.json"

loadTaskMap()

// For some reason WhatsApp keeps sending the same requests again and again. This is a workaround to fix that.
const recentMsgIds: string[] = [],
    recentMsgStoreCount = 10

export async function handleMessage(data: WebHookRequest) {
    for (const msg of data.entry[0].changes[0].value.messages) {
        if (recentMsgIds.includes(msg.id)) continue

        if (msg?.type == "text") {
            if (msg.context?.id && taskMap[msg.context?.id]) {
                // New task with a parent task
                let task = await addTask({
                    parentTask: taskMap[msg.context?.id],
                    ...parseMessage(msg.text.body)
                })

                taskMap[msg.id] = task.id

                saveTaskMap()
            } else {
                // New task
                let task = await addTask(parseMessage(msg.text.body))

                taskMap[msg.id] = task.id

                saveTaskMap()
            }
        } else if (msg.type == "reaction") {
            let status: TaskStatus

            switch (msg.reaction.emoji) {
                case "👍":
                    status = "In Progress"
                    break
                case "❤️":
                    status = "Done"
                    break
                case "🙏":
                    status = "Archived"
                    break
                default:
                    status = "Not Started"
                    break
            }

            status && await updateTask({
                id: taskMap[msg.reaction.message_id],
                status: status
            })
        }

        recentMsgIds.push(msg.id)
        if (recentMsgIds.length > recentMsgStoreCount) recentMsgIds.shift()
    }
}

// HTTPS Server ⚡

const server = https.createServer({
    key: readFileSync(CERT_PATH + "privkey.pem"),
    cert: readFileSync(CERT_PATH + "fullchain.pem"),
    ca: readFileSync(CERT_PATH + "chain.pem")
}, (req, res) => {
    const requestURL = new URL(req.url!, `http://${req.headers.host}`)

    if (requestURL.pathname == WEBHOOK_PATHNAME) {
        switch (req.method) {
            case "POST":
                let incomingData = ""

                req.on("data", chunk => { incomingData += chunk });

                req.on("end", () => {
                    try {
                        handleMessage(JSON.parse(incomingData) as WebHookRequest)
                        res.statusCode = 200
                        res.end()
                    } catch {}
                })
                break

            case "GET":
                const mode = requestURL.searchParams.get("hub.mode")
                const token = requestURL.searchParams.get("hub.verify_token")
                const challenge = requestURL.searchParams.get("hub.challenge")

                // check the mode and token sent are correct
                if (mode === "subscribe" && token === WEBHOOK_VERIFY_TOKEN) {
                    // respond with 200 OK and challenge token from the request
                    res.statusCode = 200
                    res.end(challenge)
                    console.log("Webhook verified successfully!");
                } else {
                    // respond with '403 Forbidden' if verify tokens do not match
                    res.statusCode = 403
                    res.end()
                }
                break            
        }
    } else {
        res.end("NotiTasks ⚡")
    }
});

// @ts-ignore
export const startWebhook = () => server.listen(PORT || 3000, "0.0.0.0", () => {
    console.log(`Server started on port ${PORT || 3000} ⚡`);
});

async function loadTaskMap() {
    try {
        await fs.access(taskMapFile)

        let savedMap: typeof taskMap = JSON.parse(
            (await fs.readFile(taskMapFile)).toString()
        )

        for (const id in savedMap) {
            if (Object.prototype.hasOwnProperty.call(savedMap, id)) {
                taskMap[id] = savedMap[id]
            }
        }
    } catch {}

    return taskMap
}

function saveTaskMap() {
    return fs.writeFile(taskMapFile, JSON.stringify(taskMap), {
        flag: "w"
    })
}