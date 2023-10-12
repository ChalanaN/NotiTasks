import makeWASocket, {
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeInMemoryStore,
    useMultiFileAuthState,
} from "@whiskeysockets/baileys"
import MAIN_LOGGER from "@whiskeysockets/baileys/lib/Utils/logger"
import { Boom } from "@hapi/boom"

const TASK_MSG_REGEX = /^\. /,
    NUMBER_FROM_JID_REGEX = /^\d{11}/

const logger = MAIN_LOGGER.child({})
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
        `Using WhatsApp v${version.join(".")} ${isLatest ? "[LTS]" : ""}`
    )

    const sock = makeWASocket({
        version,
        logger,
        auth: state,
        printQRInTerminal: true,
    })

    store?.bind(sock.ev)

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === "close") {
            const shouldReconnect =
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut
            console.log(
                "connection closed due to ",
                lastDisconnect?.error,
                ", reconnecting ",
                shouldReconnect
            )
            // reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp()
            }
        } else if (connection === "open") {
            console.log("opened connection")
        }
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("messages.upsert", (m) => {
        for (const msg of m.messages) {
            if (
                msg?.key?.remoteJid?.match(NUMBER_FROM_JID_REGEX)[0] ==
                    sock.user.id.match(NUMBER_FROM_JID_REGEX)[0] &&
                TASK_MSG_REGEX.test(msg.message.conversation)
            ) {
                // Add task
                console.log(m)
            }
        }
    })
    console.log(sock.user)

    return sock
}

export { connectToWhatsApp }
