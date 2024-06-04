import { configDotenv } from "dotenv"
import { addTask } from "./notion.js"
import { startWebhook } from "./whatsapp.js"
import parseMessage from "./parser.js"

configDotenv()

startWebhook()

process.stdin.resume()

process.stdin.on("data", async function (input) {
    addTask(parseMessage(input.toString()))
})
