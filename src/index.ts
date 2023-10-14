import { configDotenv } from "dotenv"
import { addTask } from "./notion"
import { connectToWhatsApp } from "./whatsapp"
import parseMessage from "./parser"

configDotenv()

connectToWhatsApp()

process.stdin.resume()

process.stdin.on("data", async function (input) {
    addTask(parseMessage(input.toString()))
})
