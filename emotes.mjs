import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, extname } from 'node:path';

export async function fetchEmotesOffline() {

	const emotes = new Map();

	await initCache();
	const cachedEmotes = await readdir(EMOTES_PATH);

	for (const cachedEmote of cachedEmotes) {

		const extension   = extname(cachedEmote);
		const encodedName = basename(cachedEmote, extension);
		const decodedName = Buffer.from(encodedName, 'base64url').toString();

		emotes.set(decodedName, join(EMOTES_PATH, cachedEmote));
	}

	return emotes;
}

export async function fetchEmotesOnline(channelID = 0) {

	const emotes = await fetchTwitchEmotes();
	let response;

	// Default
	emotes.set('BOOBA', 'https://cdn.7tv.app/emote/60aea4074b1ea4526d3c97a9/2x.webp');
	emotes.set('Looking', 'https://cdn.7tv.app/emote/60aea4074b1ea4526d3c97a9/2x.webp');
	emotes.set('SALAMI', 'https://cdn.7tv.app/emote/63557710ea3edc5b96ecc142/2x.webp');

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
	if (channelID > 0) {

		try {
			response = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${channelID}`);
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
	if (channelID > 0) {

		try {
			response = await fetch(`https://api.betterttv.net/3/cached/frankerfacez/users/twitch/${channelID}`);
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
	if (channelID > 0) {

		try {
			response = await fetch(`https://7tv.io/v3/users/twitch/${channelID}`);
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

	return emotes;
}

export async function downloadEmotes(emotes) {

	const result = {
		downloaded: [],
		failed:     []
	};

	await initCache();

	for (const [ name, url ] of emotes) {

		const response = await fetch(url);
		if (response.ok) {

			let extension = extname(url);
			if (![ 'gif', 'png', 'webp' ].includes(extension)) {

				const contentType = response.headers.get('content-type');

				switch (contentType) {

					case 'image/gif':
					case 'image/png':
					case 'image/webp':
						extension = contentType.split('/')[1];
						break;

					default:
						extension = 'png';
						continue;
				}
			}

			const encodedName = Buffer.from(name).toString('base64url');
			const filePath    = join(EMOTES_PATH, `${encodedName}.${extension}`);

			await writeFile(filePath, await response.bytes());
			result.downloaded.push(url);
		}
		else {
			result.failed.push(url);
		}
	}

	return result;
}

async function fetchTwitchEmotes(channelID = 0) {

	const emotes = new Map();
	let response;

	// Twitch Global
	response = JSON.parse( (await readFile('./emotes/twitch.json')).toString() );
	for (const emote of response.data) {

		emotes.set(
			emote.name,
			emote.images['url_2x'].replace('/light/', '/dark/')
		);
	}

	// Twitch Channel
	if (channelID > 0) {

		let emotesFile = null;
		const re = new RegExp(`(^|[^0-9])${channelID}\.json$`);

		let files = await readdir('./emotes/');
		for (const file of files) {

			if (!re.test(file)) { continue; }

			emotesFile = `./emotes/${file}`;
			break;
		}

		if (emotesFile !== null) {
			try {
				response = JSON.parse( (await readFile(emotesFile)).toString() );
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

	return emotes;
}

async function initCache() {

	return mkdir(EMOTES_PATH, { recursive: true });
}

const EMOTES_PATH = './emotes/cache';
