import { downloadEmotes, fetchEmotesOnline } from "./emotes.mjs";

// ********************************************************************** //

const CHANNEL_ID = 0;
// twitch.tv/avoidingthepuddle = 23528098
// twitch.tv/forsen            = 22484632
// twitch.tv/lirik             = 23161357

// ********************************************************************** //

const emotes = await fetchEmotesOnline(CHANNEL_ID);

console.log(`Found ${emotes.size} emotes online using channel #${CHANNEL_ID}...`);

const result = await downloadEmotes(emotes);

if (result.failed.length > 0) {
	console.error(result.failed);
}

console.log(`Downloaded ${result.downloaded.length} emotes to local disk with ${result.failed.length} errors.`);
