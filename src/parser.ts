import extractDate from "extract-date"
import { NotionTask } from "."

const REGEXPS = {
    workspace: /#(\w+)/,
    project: /\[((?:\s|\w)+)\]/,
    title: /(.*?)\s*(?:(?:by)|,|(?:from.+to\s)|$)/
}

const parseMessage = (msg: string): NotionTask => {
    let workspace = msg.match(REGEXPS.workspace)?.[1]?.trim()
    msg = msg.replace(REGEXPS.workspace, "")

    let project = msg.match(REGEXPS.project)?.[1]?.trim()
    msg = msg.replace(REGEXPS.project, "")

    let title = msg.match(REGEXPS.title)?.[1]?.trim()

    let extractedDate = extractDate(msg, {
            locale: "en",
            timezone: "Asia/Colombo",
            minimumAge: 2,
            maximumAge: 4
        }),
        date = {
            start: extractedDate[0]?.date,
            end: extractedDate[1]?.date
        }

    return {
        title,
        date,
        project,
        workspace
    }
}

export default parseMessage
