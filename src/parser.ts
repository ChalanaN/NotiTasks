import extractDate from "extract-date"
import extractTime from "extract-time"
import { NotionTask } from "."

const REGEXPS = {
    workspace: /#(\w+)/,
    project: /\[((?:\s|\w)+)\]/,
    title: /(.*?)\s*(?:(?:by)|,|(?:from.+to\s)|$)/
},
extractDateArgs = {
    locale: "en",
    timezone: "Asia/Colombo",
    minimumAge: 2,
    maximumAge: 4
}

const parseMessage = (msg: string): NotionTask => {
    let workspace = msg.match(REGEXPS.workspace)?.[1]?.trim()
    msg = msg.replace(REGEXPS.workspace, "")

    let project = msg.match(REGEXPS.project)?.[1]?.trim()
    msg = msg.replace(REGEXPS.project, "")

    let title = msg.match(REGEXPS.title)?.[1]?.trim()

    let extractedDate = extractDate(msg, extractDateArgs),
        extractedTime = extractTime(msg),
        date = {
            start: extractedDate[0]?.date,
            end: extractedDate[1]?.date
        }

    if (extractedTime.length > 0) {
        const todayDate = extractDate("today", extractDateArgs)[0].date

        date.start = `${ date.start || todayDate }T${ extractedTime[0].time }+05:30`
        if (extractedTime[1]) date.end = `${ date.end || todayDate }T${ extractedTime[1].time }+05:30`
    }

    return {
        title,
        date,
        project,
        workspace
    }
}

export default parseMessage
