import { readdirSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';

// ********************************************************************** //

const CHANNEL_ID = 0;
// twitch.tv/avoidingthepuddle = 23528098
// twitch.tv/forsen            = 22484632
// twitch.tv/lirik             = 23161357

// ********************************************************************** //

const SERVER_PORT = 8787;

// parse text chat
const REGEXP_LINE  = /\[([0-9]{1,2}:[0-9]{2}:[0-9]{2})\] ([^:]+): (.+)/; // [hh:mm:ss] Username: Message
const CHAT_PATH    = './stream/chat.txt';
const messageLines = readFileSync(CHAT_PATH).toString().split('\n');

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

// prepare emotes
const emotes = new Map();
let response;

// Twitch Global
response = JSON.parse( readFileSync('./emotes/twitch.json').toString() );
for (const emote of response.data) {

	emotes.set(
		emote.name,
		emote.images['url_2x'].replace('/light/', '/dark/')
	);
}

// Twitch Channel
if (CHANNEL_ID > 0) {

	let emotesFile = null;
	const re = new RegExp(`(^|[^0-9])${CHANNEL_ID}\.json$`);

	let files = readdirSync('./emotes/');
	for (const file of files) {

		if (!re.test(file)) { continue; }

		emotesFile = `./emotes/${file}`;
		break;
	}

	if (emotesFile !== null) {
		try {
			response = JSON.parse( readFileSync(emotesFile).toString() );
			for (const emote of response.data) {

				emotes.set(
					emote.name,
					emote.images['url_2x'].replace('/light/', '/dark/')
				);
			}
		}
		catch (err) { console.error(`Failed to fetch Twitch Channel emotes at: ${emotesFile}`); }
	}
}

// BetterTTV Global
try {
	response = await fetch('https://api.betterttv.net/3/cached/emotes/global');
	response = await response.json();
	for (const emote of response) {

		emotes.set(
			emote.code,
			`https://cdn.betterttv.net/emote/${emote.id}/2x.${emote.imageType}`
		);
	}
}
catch (err) {
	console.error(`Failed to fetch BetterTTV Global emotes: ${err}`);
	console.error(response);
}

// BetterTTV Channel
if (CHANNEL_ID > 0) {

	try {
		response = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${CHANNEL_ID}`);
		if (response.status !== 404) {
			response = await response.json();
			for (const emote of response.channelEmotes) {

				emotes.set(
					emote.code,
					`https://cdn.betterttv.net/emote/${emote.id}/2x.${emote.imageType}`
				);
			}
		}
	}
	catch (err) {
		console.error(`Failed to fetch BetterTTV Channel emotes: ${err}`);
		console.error(response);
	}
}

// FrankerFaceZ Global
try {
	response = await fetch('https://api.betterttv.net/3/cached/frankerfacez/emotes/global');
	response = await response.json();
	for (const emote of response) {

		emotes.set(
			emote.code,
			emote.images['2x']
		);
	}
}
catch (err) {
	console.error(`Failed to fetch FrankerFaceZ Global emotes: ${err}`);
	console.error(response);
}

// FrankerFaceZ Channel
if (CHANNEL_ID > 0) {

	try {
		response = await fetch(`https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${CHANNEL_ID}`);
		if (response.status !== 404) {
			response = await response.json();
			for (const emote of response) {

				emotes.set(
					emote.code,
					emote.images['2x']
				);
			}
		}
	}
	catch (err) {
		console.error(`Failed to fetch FrankerFaceZ Channel emotes: ${err}`);
		console.error(response);
	}
}

// 7TV Global
try {
	response = await fetch('https://7tv.io/v3/emote-sets/global');
	response = await response.json();
	for (const emote of response.emotes) {

		emotes.set(
			emote.name,
			`https:${emote.data.host.url}/2x.webp`
		);
	}
}
catch (err) {
	console.error(`Failed to fetch 7TV Global emotes: ${err}`);
	console.error(response);
}

// 7TV Channel
if (CHANNEL_ID > 0) {

	try {
		response = await fetch(`https://7tv.io/v3/users/twitch/${CHANNEL_ID}`);
		if (response.status !== 404) {
			response = await response.json();
			for (const emote of response.emote_set.emotes) {

				emotes.set(
					emote.name,
					`https:${emote.data.host.url}/2x.webp`
				);
			}
		}
	}
	catch (err) {
		console.error(`Failed to fetch 7TV Channel emotes: ${err}`);
		console.error(response);
	}
}

console.log(`Prepared ${emotes.size} emotes.`, '\n');

const zeroWidthEmotes = new Set([ "CandyCane", "cvHazmat", "cvMask", "IceCold", "ReinDeer", "SantaHat", "SoSnowy", "TopHat" ]);

// ********************************************************************** //

// start server
const server = createServer(async(request, response) => {

	const url   = new URL(request.url, `http://${request.headers.host}`);
	const query = url.searchParams;

	const time = query.get('time');

	// fetch messages
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
