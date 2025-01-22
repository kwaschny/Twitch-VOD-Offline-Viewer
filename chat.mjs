import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { fetchEmotesOffline, fetchEmotesOnline } from './emotes.mjs';

// ********************************************************************** //

const CHANNEL_ID = 0;
// twitch.tv/avoidingthepuddle = 23528098
// twitch.tv/forsen            = 22484632
// twitch.tv/lirik             = 23161357

// fetch emotes from local disk only
const OFFLINE = false;

// ********************************************************************** //

// parse text chat
const REGEXP_LINE  = /\[([0-9]{1,2}:[0-9]{2}:[0-9]{2})\] ([^:]+): (.+)/; // [hh:mm:ss] Username: Message
const CHAT_PATH    = './stream/chat.txt';
const messageLines = (await readFile(CHAT_PATH)).toString().split('\n');

console.log(`Starting Chat Server...`, '\n');

// build map with all messages for each second
const chat = new Map();
for (const messageLine of messageLines) {

	const parts = messageLine.match(REGEXP_LINE);
	if (parts === null) { continue; }

	let time     = parts[1];
	let username = parts[2];
	let message  = parts[3];

	// h:mm:ss to hh:mm:ss
	if (time.indexOf(':') === 1) {
		time = ('0' + time);
	}

	if (!chat.has(time)) {
		chat.set(time, []);
	}
	chat.get(time).push({ usr: username, msg: message });
}

console.log(`Prepared ${messageLines.length} messages.`);

// ********************************************************************** //

let emotes;

// prepare emotes
if (OFFLINE) {
	emotes = await fetchEmotesOffline(CHANNEL_ID);
}
else {
	emotes = await fetchEmotesOnline(CHANNEL_ID);
}

// emotes that shall be placed on top of other emotes
const zeroWidthEmotes = new Set([
	"AYAYAHair",
	"CandyCane", "cvHazmat", "cvMask",
	"doorTime",
	"hoodieU",
	"IceCold",
	"RainTime", "ReinDeer",
	"SantaHat", "SoSnowy",
	"TopHat"
]);

console.log(`Prepared ${emotes.size} emotes for ${ OFFLINE ? 'offline' : 'online' } mode.`, '\n');

// ********************************************************************** //

const SERVER_PORT = 8787;

// start server
const server = createServer(async(request, response) => {

	const url   = new URL(request.url, `http://${request.headers.host}`);
	const query = url.searchParams;

	const time = query.get('time');

	// fetch messages for requested time
	let chatEntries = [];
	if (time !== null) {
		chatEntries = (chat.get(time) ?? []);
	}

	// replace emotes
	const messages = [];
	for (const chatEntry of chatEntries) {

		const rawMessage = chatEntry.msg;

		const message = [];
		const words   = rawMessage.split(' ');

		let lastWasEmote = false;
		for (let i = 0; i < words.length; i++) {

			const word = words[i];

			if (emotes.has(word)) {

				let classList = '';
				if (lastWasEmote && zeroWidthEmotes.has(word)) {

					classList = 'zero-width';

					// adjust previous emote (to force fixed width)
					message[i - 1] = message[i - 1].replace('class=""', 'class="before-zero-width"');
				}
				else {
					lastWasEmote = true;
				}

				message.push(`<img src="${encode( emotes.get(word) )}" title="${encode(word)}" class="${classList}">`);
			}
			else {

				message.push(`<span>${encode(word)}</span>`);
				lastWasEmote = false;
			}
		}

		messages.push({
			usr: chatEntry.usr,
			msg: message.join(' ')
		});
	}

	response.setHeader('Access-Control-Allow-Origin', '*');

	response.writeHead(200, { 'Content-Type': 'application/json' });
	response.end(
		JSON.stringify(messages)
	);
});
server.listen(SERVER_PORT);

console.log(`Chat Server ready and now listening on localhost:${SERVER_PORT}`);

// ********************************************************************** //

function encode(content) {

	const entities = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#x27;'
	};

	return String(content).replaceAll(/[&<>"']/g, (matched) => entities[matched]);
};
