import fs from "fs/promises"
import { readFileSync } from "fs"
import https from "https"
import { addTask, archiveTask, updateTask } from "./notion.js"
import parseMessage from "./parser.js"
import { TaskStatus } from "./notion.js"
import { WebHookRequest } from "./webhook.js"

const { WEBHOOK_VERIFY_TOKEN, PORT, WEBHOOK_PATHNAME, CERT_PATH } = process.env;
const TASK_MSG_REGEX = /^\. /,
    NUMBER_FROM_JID_REGEX = /^\d{11}/

/**
 * `WhatsApp message id` > `Notion task id` map of the tasks created on WhatsApp
 */
export const taskMap: { [id: string]: string } = {}
const taskMapFile = "./taskmap.json"

loadTaskMap()

export async function handleMessage(data: WebHookRequest) {
    for (const msg of data.entry[0].changes[0].value.messages) {
        if (msg?.type == "text") {
            // New task
            let task = await addTask(parseMessage(msg.text.body))

            taskMap[msg.id] = task.id

            saveTaskMap()
        } else {
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
                case "":
                    status = "Not Started"
                    break
            }

            status && await updateTask({
                id: taskMap[msg.reaction.message_id],
                status: status
            })
        }
    }
}

// HTTPS Server ⚡

const server = https.createServer({
    key: readFileSync(CERT_PATH + "privkey.pem"),
    cert: readFileSync(CERT_PATH + "fullchain.pem"),
    ca: readFileSync(CERT_PATH + "chain.pem")
}, (req, res) => {
    const requestURL = new URL(req.url!, `http://${req.headers.host}`)

    console.log(requestURL.href)

    if (requestURL.pathname == WEBHOOK_PATHNAME) {
        switch (req.method) {
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

            case "POST":
                let incomingData = ""
                let data
                req.on("data", chunk => { incomingData += chunk });

                req.on("end", () => {
                    // log incoming messages
                    console.log("Incoming webhook message:", incomingData);
                })
                break
        }
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