import { configDotenv } from "dotenv"
import { addTask } from "./notion.js"
import { connectToWhatsApp } from "./whatsapp.js"
import parseMessage from "./parser.js"

configDotenv()

connectToWhatsApp()

process.stdin.resume()

process.stdin.on("data", async function (input) {
    addTask(parseMessage(input.toString()))
})
