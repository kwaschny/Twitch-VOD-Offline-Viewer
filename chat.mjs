import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';

// ********************************************************************** //

const CHANNEL_ID = 0;

// ********************************************************************** //

const SERVER_PORT = 8787;

// parse text chat
const REGEXP_LINE  = /\[([0-9]{1,2}:[0-9]{2}:[0-9]{2})\] [^:]+: (.+)/; // [hh:mm:ss] Username: Message
const CHAT_PATH    = './stream/chat.txt';
const messageLines = readFileSync(CHAT_PATH).toString().split('\n');

console.log(`Starting Chat Server...`, '\n');

// build map with all messages for each second
const chat = new Map();
for (const messageLine of messageLines) {

	const parts = messageLine.match(REGEXP_LINE);
	if (parts === null) { continue; }

	let time    = parts[1];
	let message = parts[2];

	// h:mm:ss to hh:mm:ss
	if (time.indexOf(':') === 1) {
		time = ('0' + time);
	}

	if (!chat.has(time)) {
		chat.set(time, []);
	}
	chat.get(time).push(message);
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

	let emotesFile = `./emotes/${CHANNEL_ID}.json`;
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
catch (err) { console.error(`Failed to fetch BetterTTV Global emotes: ${err}`); }

// BetterTTV Channel
if (CHANNEL_ID > 0) {

	try {
		response = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${CHANNEL_ID}`);
		response = await response.json();
		for (const emote of response.channelEmotes) {

			emotes.set(
				emote.code,
				`https://cdn.betterttv.net/emote/${emote.id}/2x.${emote.imageType}`
			);
		}
	}
	catch (err) { console.error(`Failed to fetch BetterTTV Channel emotes: ${err}`); }
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
catch (err) { console.error(`Failed to fetch FrankerFaceZ Global emotes: ${err}`); }

// FrankerFaceZ Channel
if (CHANNEL_ID > 0) {

	try {
		response = await fetch(`https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${CHANNEL_ID}`);
		response = await response.json();
		for (const emote of response) {

			emotes.set(
				emote.code,
				emote.images['2x']
			);
		}
	}
	catch (err) { console.error(`Failed to fetch FrankerFaceZ Channel emotes: ${err}`); }
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
catch (err) { console.error(`Failed to fetch 7TV Global emotes: ${err}`); }

// 7TV Channel
if (CHANNEL_ID > 0) {

	try {
		response = await fetch(`https://7tv.io/v3/users/twitch/${CHANNEL_ID}`);
		response = await response.json();
		for (const emote of response.emote_set.emotes) {

			emotes.set(
				emote.name,
				`https:${emote.data.host.url}/2x.webp`
			);
		}
	}
	catch (err) { console.error(`Failed to fetch 7TV Channel emotes: ${err}`); }
}

console.log(`Prepared ${emotes.size} emotes.`, '\n');

// ********************************************************************** //

// start server
const server = createServer(async(request, response) => {

	const url   = new URL(request.url, `http://${request.headers.host}`);
	const query = url.searchParams;

	const time = query.get('time');

	// fetch messages
	let rawMessages = [];
	if (time !== null) {
		rawMessages = (chat.get(time) ?? []);
	}

	// replace emotes
	const messages = [];
	for (const rawMessage of rawMessages) {

		const words = rawMessage.split(' ');

		const message = [];
		for (const word of words) {

			if (emotes.has(word)) {
				message.push(`<img src="${encode( emotes.get(word) )}" title="${encode(word)}">`);
			}
			else {
				message.push(`<span>${encode(word)}</span>`);
			}
		}

		messages.push( message.join(' ') );
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
