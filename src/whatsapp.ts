import fs from "fs/promises"
import { makeWASocket,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    useMultiFileAuthState
} from "@whiskeysockets/baileys"
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger.js"
import { Boom } from "@hapi/boom"
import { addTask, archiveTask, updateTask } from "./notion.js"
import parseMessage from "./parser.js"
import { TaskStatus } from "./notion.js"

const TASK_MSG_REGEX = /^\. /,
    NUMBER_FROM_JID_REGEX = /^\d{11}/

/**
 * `WhatsApp message id` > `Notion task id` map of the tasks created on WhatsApp
 */
export const taskMap: { [id: string]: string } = {}
const taskMapFile = "./taskmap.json"

loadTaskMap()

const logger = MAIN_LOGGER.default.child({})
logger.level = "error"

const useStore = !process.argv.includes("--no-store")

// the store maintains the data of the WA connection in memory
// can be written out to a file & read from it
const store = useStore ? makeInMemoryStore({ logger }) : undefined
store?.readFromFile("./baileys_store_multi.json")
// save every 10s
setInterval(() => {
    store?.writeToFile("./baileys_store_multi.json")
}, 10_000)

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(
        "baileys_auth_info"
    )
    const { version, isLatest } = await fetchLatestBaileysVersion()
    console.log(
        `Using \x1b[92mWhatsApp\x1b[0m v${version.join(".")}\x1b[0m ${
            isLatest ? "\x1b[102m LTS \x1b[0m" : ""
        }`
    )

    const sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: true
    })

    store?.bind(sock.ev)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            const shouldReconnect =
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut
            console.log(
                "❌ \x1b[31mWhatsApp Connection Closed\x1b[0m due to ",
                lastDisconnect?.error,
                shouldReconnect ? "\n🔁 Reconnecting" : ""
            )
            // reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp()
            }
        } else if (connection === "open") {
            console.log("✅ Opened WhatsApp Connection")
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", async (m) => {
        for (const msg of m.messages) {
            if (msg?.key?.remoteJid?.match(NUMBER_FROM_JID_REGEX)?.[0] == sock.user.id.match(NUMBER_FROM_JID_REGEX)[0]) {
                // New task
                if (TASK_MSG_REGEX.test(msg.message.conversation)) {
                    let task = await addTask(parseMessage(msg.message.conversation.replace(TASK_MSG_REGEX, "")))

                    taskMap[msg.key.id] = task.id

                    saveTaskMap()
                }
                // New task with a parent task
                else if (TASK_MSG_REGEX.test(msg.message.extendedTextMessage?.text) && taskMap[msg.message.extendedTextMessage?.contextInfo.stanzaId]) {
                    let task = await addTask({
                        parentTask: taskMap[msg.message.extendedTextMessage.contextInfo.stanzaId],
                        ...parseMessage(msg.message.extendedTextMessage.text.replace(TASK_MSG_REGEX, ""))
                    })

                    taskMap[msg.key.id] = task.id

                    saveTaskMap()
                }
                // Updated task
                else if (msg.message.editedMessage && taskMap[msg.message.editedMessage.message.protocolMessage.key.id]) {
                    updateTask({
                        id: taskMap[msg.message.editedMessage.message.protocolMessage.key.id],
                        ...parseMessage(msg.message.editedMessage.message.protocolMessage.editedMessage.conversation.replace(TASK_MSG_REGEX, ""))
                    })
                }
                // Task status update
                else if (msg.message.reactionMessage && taskMap[msg.message.reactionMessage.key.id]) {
                    // This event doesn't get called when the reaction is removed as of baileys v6.5.60
                    // The solution is to change `if (reaction.text)` to `if (reaction.text || reaction.text == "")`
                    // on ./node_modules/@whiskeysockets/baileys/lib/Utils/messages.js:615
                    let status: TaskStatus

                    switch (msg.message.reactionMessage.text) {
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
                        id: taskMap[msg.message.reactionMessage.key.id],
                        status: status
                    })
                }
            }
        }
    })

    sock.ev.on("messages.delete", async m => {
        // @ts-ignore
        if (m.keys) {
            // @ts-ignore
            for (const msgKey of m.keys) {
                // Delete task
                if (msgKey?.remoteJid?.match(NUMBER_FROM_JID_REGEX)?.[0] == sock.user.id.match(NUMBER_FROM_JID_REGEX)[0] && taskMap[msgKey.id]) {
                    archiveTask(taskMap[msgKey.id])
                    delete taskMap[msgKey.id]
                    saveTaskMap()
                }
            }
        }
    })

    return sock
}

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

export { connectToWhatsApp }
