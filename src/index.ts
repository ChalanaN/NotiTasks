import { onRequest } from "firebase-functions/v2/https"
import { initializeApp } from "firebase-admin/app"
import { configDotenv } from "dotenv"

configDotenv()

if (process.argv.includes("-s") || process.argv.includes("--standalone")) {
    // Run as a standalone app 💨
    (async () => {
        console.log("\x1b[95m\x1b[1mNotiTasks\x1b[0m ⚡\n")

        const { addTask } = await import("./notion.js")
        const { default: parseMessage } = await import("./parser.js")

        process.stdin.resume()

        process.stdin.on("data", async function (input) {
            addTask(parseMessage(input.toString()))
        })
    })()
} else {
    // Cloud function ☁️
    initializeApp()
}

export const addTask = onRequest(async (req, res) => {
    const { addTask } = await import("./notion.js")
    const { default: parseMessage } = await import("./parser.js")

    if (typeof req.query.message == "string") {
        let task = addTask(parseMessage(req.query.message))

        console.log(req.query.message, task)

        res.status(200).json({
            success: true,
            task
        })
    } else {
        res.status(400).json({
            success: false,
            error: "No message provided"
        })
    }
});